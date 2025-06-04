// OAuth popup utility for multi-tab Google authentication
import { getTabId, setCurrentTabUser } from './api';

/**
 * Test if popups are allowed
 * @returns {boolean} True if popups are allowed
 */
export const testPopupAllowed = () => {
  try {
    const testPopup = window.open('', 'test', 'width=1,height=1');
    if (testPopup) {
      testPopup.close();
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

/**
 * Opens a popup window for OAuth authentication
 * @param {string} url - The OAuth URL to open
 * @param {string} name - Name for the popup window
 * @param {Object} options - Popup window options
 * @returns {Promise} Promise that resolves with user data or rejects with error
 */
export const openOAuthPopup = (url, name = 'oauth', options = {}) => {
  return new Promise((resolve, reject) => {
    // Prepare all data synchronously before opening popup
    const tabId = getTabId();
    const separator = url.includes('?') ? '&' : '?';
    const urlWithTabId = `${url}${separator}tabId=${tabId}`;

    // Default popup options
    const defaultOptions = {
      width: 500,
      height: 600,
      scrollbars: 'yes',
      resizable: 'yes',
      toolbar: 'no',
      menubar: 'no',
      location: 'no',
      directories: 'no',
      status: 'no',
    };

    const popupOptions = { ...defaultOptions, ...options };

    // Calculate center position
    const left = Math.round(window.screen.width / 2 - popupOptions.width / 2);
    const top = Math.round(window.screen.height / 2 - popupOptions.height / 2);

    const optionsString = Object.entries({
      ...popupOptions,
      left,
      top,
    })
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    // Debug logging
    console.log('Opening OAuth popup:', {
      url: urlWithTabId,
      name,
      options: optionsString,
      userActivation: navigator.userActivation?.isActive
    });

    // Try popup first, fallback to new tab if popup fails
    let popup = window.open(urlWithTabId, name, optionsString);

    // If popup failed, try opening in a new tab
    if (!popup) {
      console.log('Popup failed, trying new tab...');
      popup = window.open(urlWithTabId, '_blank');
    }

    console.log('Popup result:', {
      popup: !!popup,
      closed: popup?.closed,
      location: popup?.location?.href
    });

    if (!popup || popup.closed) {
      const errorMsg = !popup ?
        'Popup blocked by browser. Please allow popups for this site.' :
        'Popup was immediately closed.';
      reject(new Error(errorMsg));
      return;
    }

    // Try to focus the popup
    try {
      popup.focus();
    } catch (e) {
      console.warn('Could not focus popup:', e);
    }

    // Listen for messages from popup
    const messageListener = (event) => {
      // Verify origin for security - allow same origin or wildcard for production
      if (event.origin !== window.location.origin && event.origin !== 'null') {
        console.warn('Ignoring message from different origin:', event.origin);
        return;
      }

      console.log('Received message from popup:', event.data);

      if (event.data.type === 'OAUTH_SUCCESS') {
        console.log('OAuth success received via postMessage');
        cleanup();

        // Store user data in tab-specific storage
        const userData = event.data.userData;
        setCurrentTabUser(userData);

        resolve(userData);
      } else if (event.data.type === 'OAUTH_ERROR') {
        console.log('OAuth error received via postMessage:', event.data.error);
        cleanup();
        reject(new Error(event.data.error || 'OAuth authentication failed'));
      }
    };

    // Listen for localStorage changes as fallback
    const storageListener = (event) => {
      if (event.key === 'oauth_popup_result') {
        try {
          const result = JSON.parse(event.newValue);
          if (result && result.timestamp && (Date.now() - result.timestamp < 30000)) { // 30 second window
            console.log('OAuth result received via localStorage:', result.type);
            cleanup();

            if (result.type === 'OAUTH_SUCCESS') {
              const userData = result.userData;
              setCurrentTabUser(userData);
              resolve(userData);
            } else if (result.type === 'OAUTH_ERROR') {
              reject(new Error(result.error || 'OAuth authentication failed'));
            }

            // Clean up the localStorage item
            localStorage.removeItem('oauth_popup_result');
          }
        } catch (error) {
          console.warn('Failed to parse OAuth result from localStorage:', error);
        }
      }
    };

    // Polling fallback for localStorage (in case storage event doesn't fire)
    const pollStorage = setInterval(() => {
      try {
        const result = localStorage.getItem('oauth_popup_result');
        if (result) {
          const parsedResult = JSON.parse(result);
          if (parsedResult && parsedResult.timestamp && (Date.now() - parsedResult.timestamp < 30000)) {
            console.log('OAuth result received via localStorage polling:', parsedResult.type);
            cleanup();

            if (parsedResult.type === 'OAUTH_SUCCESS') {
              const userData = parsedResult.userData;
              setCurrentTabUser(userData);
              resolve(userData);
            } else if (parsedResult.type === 'OAUTH_ERROR') {
              reject(new Error(parsedResult.error || 'OAuth authentication failed'));
            }

            localStorage.removeItem('oauth_popup_result');
          }
        }
      } catch (error) {
        console.warn('Failed to poll OAuth result from localStorage:', error);
      }
    }, 500); // Poll every 500ms for faster response

    // Check if popup is closed manually
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('OAuth popup was closed before completion'));
      }
    }, 1000);

    // Add BroadcastChannel listener as another fallback
    let broadcastChannel = null;
    try {
      broadcastChannel = new BroadcastChannel('oauth_channel');
      broadcastChannel.onmessage = (event) => {
        console.log('OAuth result received via BroadcastChannel:', event.data.type);
        if (event.data.type === 'OAUTH_SUCCESS' || event.data.type === 'OAUTH_ERROR') {
          if (event.data.type === 'OAUTH_SUCCESS') {
            cleanup();
            const userData = event.data.userData;
            setCurrentTabUser(userData);
            resolve(userData);
          } else {
            cleanup();
            reject(new Error(event.data.error || 'OAuth authentication failed'));
          }
        }
      };
    } catch (error) {
      console.warn('BroadcastChannel not available:', error);
    }

    const cleanup = () => {
      window.removeEventListener('message', messageListener);
      window.removeEventListener('storage', storageListener);
      clearInterval(checkClosed);
      clearInterval(pollStorage);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
      if (!popup.closed) {
        popup.close();
      }
    };

    // Add message listener
    window.addEventListener('message', messageListener);

    // Add storage listener for fallback
    window.addEventListener('storage', storageListener);

    // Cleanup after 5 minutes (timeout)
    setTimeout(() => {
      if (!popup.closed) {
        cleanup();
        reject(new Error('OAuth popup timed out'));
      }
    }, 5 * 60 * 1000);
  });
};

/**
 * Initiates Google OAuth popup flow with fallback
 * @param {boolean} useRedirectFallback - Whether to use redirect as fallback
 * @returns {Promise} Promise that resolves with user data
 */
export const googleOAuthPopup = (useRedirectFallback = false) => {
  return new Promise((resolve, reject) => {
    // Check if popups are likely to work
    if (!testPopupAllowed()) {
      if (useRedirectFallback) {
        // Fallback to redirect
        window.location.href = '/api/auth/google';
        return;
      } else {
        reject(new Error('Popups are blocked. Please allow popups for this site or try the redirect method.'));
        return;
      }
    }

    // Try popup first
    openOAuthPopup('/api/auth/google/popup', 'google_oauth', {
      width: 500,
      height: 600,
    })
    .then(resolve)
    .catch(error => {
      console.error('Popup OAuth failed:', error);

      // If popup fails and redirect fallback is enabled
      if (error.message.includes('Popup blocked') && useRedirectFallback) {
        console.log('Falling back to redirect method');
        window.location.href = '/api/auth/google';
        return;
      }

      // Otherwise, provide helpful error message
      if (error.message.includes('Popup blocked')) {
        reject(new Error('Popup blocked. Please allow popups for this site and try again.'));
      } else {
        reject(error);
      }
    });
  });
};

/**
 * Handles OAuth callback in popup window
 * Should be called in the popup callback page
 */
export const handleOAuthPopupCallback = () => {
  console.log('OAuth popup callback started');
  console.log('window.opener available:', !!window.opener);
  console.log('window.opener closed:', window.opener?.closed);
  console.log('Current URL:', window.location.href);
  console.log('Window origin:', window.location.origin);
  console.log('Window name:', window.name);

  // Add a fallback timeout to close the popup if something goes wrong
  const fallbackTimeout = setTimeout(() => {
    console.log('OAuth popup callback timeout - closing window');
    // Use localStorage as fallback when window.opener is null
    localStorage.setItem('oauth_popup_result', JSON.stringify({
      type: 'OAUTH_ERROR',
      error: 'OAuth callback timed out',
      timestamp: Date.now()
    }));

    // Try multiple methods to close the window
    try {
      window.close();
    } catch (e) {
      console.warn('Failed to close window:', e);
      // Fallback: redirect to a close page or show a message
      document.body.innerHTML = '<div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;"><h2>Authentication Complete</h2><p>You can close this window now.</p></div>';
    }
  }, 15000); // Increased to 15 second timeout

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth');
    const oauthError = urlParams.get('error');
    const setupRequired = urlParams.get('setup');
    const sessionPath = urlParams.get('session');
    const tabId = urlParams.get('tabId');

    console.log('OAuth callback params:', {
      oauthSuccess,
      oauthError,
      setupRequired,
      sessionPath,
      tabId
    });

    if (oauthSuccess === 'success') {
      // Debug logging
      console.log('OAuth popup callback - fetching user data with session:', sessionPath);

      // Fetch user data
      fetch(`/api/auth/oauth/user?session=${sessionPath || ''}`, {
        credentials: 'include'
      })
        .then(response => {
          console.log('OAuth user fetch response:', response.status, response.statusText);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        })
        .then(userData => {
          console.log('OAuth user data received:', userData);

          // Add session path and tab ID to user data
          userData.sessionPath = sessionPath;
          userData.tabId = tabId;
          userData.setupRequired = setupRequired === 'required';

          // Try to send message to parent window
          const messageData = {
            type: 'OAUTH_SUCCESS',
            userData: userData,
            timestamp: Date.now()
          };

          const sendMethods = [];

          // Method 1: Try window.opener.postMessage with multiple attempts
          if (window.opener && !window.opener.closed) {
            try {
              // Try different origins for cross-origin scenarios
              const origins = [
                window.location.origin,
                '*', // Last resort - less secure but works for same-site
              ];

              for (const origin of origins) {
                try {
                  window.opener.postMessage(messageData, origin);
                  console.log(`Message sent via window.opener to origin: ${origin}`);
                  sendMethods.push('window.opener');
                  break;
                } catch (error) {
                  console.warn(`Failed to send message via window.opener to ${origin}:`, error);
                }
              }
            } catch (error) {
              console.warn('Failed to send message via window.opener:', error);
            }
          } else {
            console.warn('window.opener is null or closed, using fallback methods');
          }

          // Method 2: Always use localStorage as fallback (even if postMessage worked)
          console.log('Setting localStorage fallback for OAuth result');
          localStorage.setItem('oauth_popup_result', JSON.stringify(messageData));
          sendMethods.push('localStorage');

          // Method 3: Try broadcasting to all windows
          try {
            const broadcastChannel = new BroadcastChannel('oauth_channel');
            broadcastChannel.postMessage(messageData);
            broadcastChannel.close();
            console.log('Message sent via BroadcastChannel');
            sendMethods.push('BroadcastChannel');
          } catch (error) {
            console.warn('BroadcastChannel not available:', error);
          }

          console.log('OAuth success sent via methods:', sendMethods);

          // Clear timeout and close popup with delay
          clearTimeout(fallbackTimeout);

          // Longer delay to ensure all communication methods have time to work
          setTimeout(() => {
            try {
              window.close();
            } catch (e) {
              console.warn('Failed to close window:', e);
              // Show success message if window can't be closed
              document.body.innerHTML = '<div style="text-align: center; padding: 50px; font-family: Arial, sans-serif; background: #f0f8ff;"><h2 style="color: #28a745;">✓ Authentication Successful!</h2><p>You can close this window now.</p></div>';
            }
          }, 1000); // Increased delay
        })
        .catch(error => {
          console.error('Failed to fetch user data:', error);

          const errorData = {
            type: 'OAUTH_ERROR',
            error: `Failed to fetch user data: ${error.message}`,
            timestamp: Date.now()
          };

          const errorSendMethods = [];

          // Try multiple methods to send error message
          if (window.opener && !window.opener.closed) {
            try {
              const origins = [window.location.origin, '*'];
              for (const origin of origins) {
                try {
                  window.opener.postMessage(errorData, origin);
                  console.log(`Error message sent via window.opener to origin: ${origin}`);
                  errorSendMethods.push('window.opener');
                  break;
                } catch (e) {
                  console.warn(`Failed to send error via window.opener to ${origin}:`, e);
                }
              }
            } catch (e) {
              console.warn('Failed to send error via window.opener:', e);
            }
          }

          // Always use localStorage as fallback
          localStorage.setItem('oauth_popup_result', JSON.stringify(errorData));
          errorSendMethods.push('localStorage');

          // Try BroadcastChannel
          try {
            const broadcastChannel = new BroadcastChannel('oauth_channel');
            broadcastChannel.postMessage(errorData);
            broadcastChannel.close();
            errorSendMethods.push('BroadcastChannel');
          } catch (error) {
            console.warn('BroadcastChannel not available for error:', error);
          }

          console.log('OAuth error sent via methods:', errorSendMethods);

          clearTimeout(fallbackTimeout);
          setTimeout(() => {
            try {
              window.close();
            } catch (e) {
              console.warn('Failed to close window:', e);
              document.body.innerHTML = '<div style="text-align: center; padding: 50px; font-family: Arial, sans-serif; background: #ffe6e6;"><h2 style="color: #dc3545;">✗ Authentication Failed</h2><p>You can close this window now.</p></div>';
            }
          }, 1000);
        });
    } else if (oauthError) {
      let errorMessage = 'Google login failed';
      
      switch (oauthError) {
        case 'oauth_failed':
          errorMessage = 'Google authentication was cancelled or failed';
          break;
        case 'oauth_callback_failed':
          errorMessage = 'Failed to process Google login';
          break;
        default:
          errorMessage = 'Google login failed';
      }

      // Send error message to parent window
      const errorData = {
        type: 'OAUTH_ERROR',
        error: errorMessage,
        timestamp: Date.now()
      };

      const errorSendMethods = [];

      if (window.opener && !window.opener.closed) {
        try {
          const origins = [window.location.origin, '*'];
          for (const origin of origins) {
            try {
              window.opener.postMessage(errorData, origin);
              console.log(`OAuth error sent via window.opener to origin: ${origin}`);
              errorSendMethods.push('window.opener');
              break;
            } catch (e) {
              console.warn(`Failed to send OAuth error via window.opener to ${origin}:`, e);
            }
          }
        } catch (e) {
          console.warn('Failed to send OAuth error via window.opener:', e);
        }
      }

      // Always use localStorage as fallback
      localStorage.setItem('oauth_popup_result', JSON.stringify(errorData));
      errorSendMethods.push('localStorage');

      // Try BroadcastChannel
      try {
        const broadcastChannel = new BroadcastChannel('oauth_channel');
        broadcastChannel.postMessage(errorData);
        broadcastChannel.close();
        errorSendMethods.push('BroadcastChannel');
      } catch (error) {
        console.warn('BroadcastChannel not available for OAuth error:', error);
      }

      console.log('OAuth error sent via methods:', errorSendMethods);

      // Clear timeout and close popup
      clearTimeout(fallbackTimeout);
      setTimeout(() => {
        try {
          window.close();
        } catch (e) {
          console.warn('Failed to close window:', e);
          document.body.innerHTML = '<div style="text-align: center; padding: 50px; font-family: Arial, sans-serif; background: #ffe6e6;"><h2 style="color: #dc3545;">✗ Authentication Failed</h2><p>You can close this window now.</p></div>';
        }
      }, 1000);
    }
  } catch (error) {
    console.error('OAuth popup callback error:', error);

    const errorData = {
      type: 'OAUTH_ERROR',
      error: 'OAuth callback processing failed',
      timestamp: Date.now()
    };

    const errorSendMethods = [];

    if (window.opener && !window.opener.closed) {
      try {
        const origins = [window.location.origin, '*'];
        for (const origin of origins) {
          try {
            window.opener.postMessage(errorData, origin);
            console.log(`Callback error sent via window.opener to origin: ${origin}`);
            errorSendMethods.push('window.opener');
            break;
          } catch (e) {
            console.warn(`Failed to send callback error via window.opener to ${origin}:`, e);
          }
        }
      } catch (e) {
        console.warn('Failed to send callback error via window.opener:', e);
      }
    }

    // Always use localStorage as fallback
    localStorage.setItem('oauth_popup_result', JSON.stringify(errorData));
    errorSendMethods.push('localStorage');

    // Try BroadcastChannel
    try {
      const broadcastChannel = new BroadcastChannel('oauth_channel');
      broadcastChannel.postMessage(errorData);
      broadcastChannel.close();
      errorSendMethods.push('BroadcastChannel');
    } catch (error) {
      console.warn('BroadcastChannel not available for callback error:', error);
    }

    console.log('Callback error sent via methods:', errorSendMethods);

    clearTimeout(fallbackTimeout);
    setTimeout(() => {
      try {
        window.close();
      } catch (e) {
        console.warn('Failed to close window:', e);
        document.body.innerHTML = '<div style="text-align: center; padding: 50px; font-family: Arial, sans-serif; background: #ffe6e6;"><h2 style="color: #dc3545;">✗ Authentication Error</h2><p>You can close this window now.</p></div>';
      }
    }, 1000);
  }
};
