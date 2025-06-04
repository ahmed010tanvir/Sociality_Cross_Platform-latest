// Enhanced API utilities for multi-tab OAuth support
import { useRecoilValue } from 'recoil';
import { userAtom } from '../atoms';

// Clear authentication data for current tab
export const clearCurrentTabAuth = () => {
  const tabId = getTabId();
  const userKey = `user-threads-${tabId}`;
  localStorage.removeItem(userKey);
};

// Authentication recovery utility
export const handleAuthenticationError = (navigate, setUser, showToast) => {
  console.warn('Authentication failed, redirecting to login');
  clearCurrentTabAuth();
  if (setUser) setUser(null);
  if (showToast) {
    showToast('Error', 'Your session has expired. Please log in again.', 'error');
  }
  if (navigate) {
    navigate('/auth', { replace: true });
  }
};

// Helper to get the current user's session path
export const useSessionPath = () => {
  const user = useRecoilValue(userAtom);
  return user?.sessionPath || '';
};

// Get current tab ID, create one if it doesn't exist
export const getTabId = () => {
  let tabId = sessionStorage.getItem('tabId');
  if (!tabId) {
    tabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('tabId', tabId);
  }
  return tabId;
};

// Get user data for current tab
export const getCurrentTabUser = () => {
  const tabId = getTabId();
  const userKey = `user-threads-${tabId}`;
  const userData = localStorage.getItem(userKey);
  return userData ? JSON.parse(userData) : null;
};

// Set user data for current tab
export const setCurrentTabUser = (userData) => {
  const tabId = getTabId();
  const userKey = `user-threads-${tabId}`;
  if (userData) {
    localStorage.setItem(userKey, JSON.stringify(userData));
  } else {
    localStorage.removeItem(userKey);
  }
};

// Validate if user has valid authentication
export const validateAuthentication = async () => {
  const user = getCurrentTabUser();
  if (!user) return false;

  try {
    // Test authentication with a simple endpoint
    const response = await fetch('/api/auth/oauth/user' + (user.sessionPath ? `?session=${user.sessionPath}` : ''), {
      credentials: 'include'
    });
    return response.ok;
  } catch (error) {
    console.error('Authentication validation failed:', error);
    return false;
  }
};



// Enhanced fetch with session support and authentication validation
export const fetchWithSession = async (url, options = {}) => {
  const user = getCurrentTabUser();
  const sessionPath = user?.sessionPath || '';

  console.log('=== FETCH WITH SESSION DEBUG ===');
  console.log('URL:', url);
  console.log('User:', user ? {
    id: user._id,
    username: user.username,
    isProfileComplete: user.isProfileComplete,
    sessionPath: user.sessionPath
  } : null);
  console.log('Session path:', sessionPath);

  // Add session path to URL if it exists
  const urlWithSession = sessionPath ?
    `${url}${url.includes('?') ? '&' : '?'}session=${sessionPath}` :
    url;

  console.log('Final URL:', urlWithSession);

  try {
    const response = await fetch(urlWithSession, {
      ...options,
      credentials: 'include'
    });

    console.log('Response status:', response.status);

    // If we get a 401, the authentication is invalid
    if (response.status === 401) {
      console.warn('Authentication failed, clearing local auth data');

      // For new users who just completed profile setup, try to re-validate authentication
      if (user && user.isProfileComplete && sessionPath) {
        console.log('Attempting to re-validate authentication for recently completed profile');
        try {
          const authValidation = await fetch('/api/auth/oauth/user' + (sessionPath ? `?session=${sessionPath}` : ''), {
            credentials: 'include'
          });

          if (authValidation.ok) {
            const validatedUser = await authValidation.json();
            console.log('Re-validation successful, updating user data');
            setCurrentTabUser(validatedUser);

            // Retry the original request
            return fetch(urlWithSession, {
              ...options,
              credentials: 'include'
            });
          }
        } catch (validationError) {
          console.error('Re-validation failed:', validationError);
        }
      }

      clearCurrentTabAuth();

      // Try once more without session path (fallback to default cookie)
      if (sessionPath) {
        console.log('Retrying request without session path');
        return fetch(url, {
          ...options,
          credentials: 'include'
        });
      }
    }

    return response;
  } catch (error) {
    console.error('Fetch with session failed:', error);
    throw error;
  }
};

// API request helper with session support
export const apiRequest = async (endpoint, method = 'GET', data = null) => {
  // Use relative URL to leverage Vite's proxy configuration
  const url = `/api${endpoint}`;

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetchWithSession(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
};

// Post API functions
export const createPost = (postData) => apiRequest('/posts/create', 'POST', postData);
export const likePost = (postId) => apiRequest(`/posts/like/${postId}`, 'POST');
export const replyToPost = (postId, replyData) => apiRequest(`/posts/reply/${postId}`, 'POST', replyData);
export const repostPost = (postId) => apiRequest(`/posts/repost/${postId}`, 'POST');
export const updatePost = (postId, postData) => apiRequest(`/posts/${postId}`, 'PUT', postData);
export const deletePost = (postId) => apiRequest(`/posts/${postId}`, 'DELETE');
export const markPostNotInterested = (postId) => apiRequest(`/posts/not-interested/${postId}`, 'POST');

// User API functions
export const followUser = (userId) => apiRequest(`/users/follow/${userId}`, 'POST');
export const unfollowUser = (userId) => apiRequest(`/users/follow/${userId}`, 'DELETE');
export const updateUser = (userId, userData) => apiRequest(`/users/update/${userId}`, 'PUT', userData);
export const getUserProfile = (username) => apiRequest(`/users/profile/${username}`);

// Message API functions
export const getMessages = (userId) => apiRequest(`/messages/${userId}`);
export const getConversations = () => apiRequest('/messages/conversations');
export const sendMessage = (messageData) => apiRequest('/messages', 'POST', messageData);

// Notification API functions
export const getNotifications = (page = 1, limit = 10) =>
  apiRequest(`/notifications?page=${page}&limit=${limit}`);
export const markNotificationAsRead = (notificationId) =>
  apiRequest(`/notifications/read/${notificationId}`, 'PUT');
export const deleteNotification = (notificationId) =>
  apiRequest(`/notifications/${notificationId}`, 'DELETE');