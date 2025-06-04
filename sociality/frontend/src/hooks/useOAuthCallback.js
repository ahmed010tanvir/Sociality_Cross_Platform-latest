import { useEffect } from 'react';
import { useSetRecoilState } from 'recoil';
import { useNavigate } from 'react-router-dom';
import { userAtom } from '../atoms';
import useShowToast from './useShowToast';
import { setCurrentTabUser, getTabId } from '../utils/api';

const useOAuthCallback = () => {
    const setUser = useSetRecoilState(userAtom);
    const showToast = useShowToast();
    const navigate = useNavigate();

    useEffect(() => {
        const handleOAuthCallback = async () => {
            // Skip OAuth callback handling if we're on the popup callback page
            if (window.location.pathname === '/oauth-popup-callback') {
                return;
            }

            const urlParams = new URLSearchParams(window.location.search);
            const oauthSuccess = urlParams.get('oauth');
            const oauthError = urlParams.get('error');
            const setupRequired = urlParams.get('setup');
            const sessionPath = urlParams.get('session');

            if (oauthSuccess === 'success') {
                try {
                    // Fetch user data after successful OAuth
                    const res = await fetch(`/api/auth/oauth/user?session=${sessionPath || ''}`, {
                        credentials: 'include'
                    });

                    if (res.ok) {
                        const userData = await res.json();
                        
                        // Store session path with user data
                        userData.sessionPath = sessionPath;

                        // Store in tab-specific localStorage using utility function
                        setCurrentTabUser(userData);
                        
                        // Set as current user
                        setUser(userData);
                        showToast('Success', 'Successfully logged in with Google!', 'success');

                        // Clean up URL parameters first
                        window.history.replaceState({}, document.title, window.location.pathname);

                        // Check if profile setup is required (only for NEW Google OAuth users)
                        if (setupRequired === 'required' || !userData.isProfileComplete) {
                            console.log('❌ FRONTEND: Redirecting to profile setup');
                            console.log('Reason: setupRequired =', setupRequired, ', isProfileComplete =', userData.isProfileComplete);
                            showToast('Info', 'Welcome! Please complete your profile setup to get started', 'info');
                            setTimeout(() => {
                                navigate('/profile-setup', { replace: true });
                            }, 100);
                        } else {
                            console.log('✅ FRONTEND: Redirecting directly to home');
                            showToast('Success', 'Welcome back!', 'success');
                            setTimeout(() => {
                                navigate('/', { replace: true });
                            }, 100);
                        }
                    } else {
                        throw new Error('Failed to fetch user data');
                    }
                } catch (error) {
                    console.error('OAuth callback error:', error);
                    showToast('Error', 'Failed to complete Google login', 'error');

                    // Clean up URL parameters and redirect to auth page on error
                    window.history.replaceState({}, document.title, window.location.pathname);
                    navigate('/auth', { replace: true });
                }
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

                showToast('Error', errorMessage, 'error');

                // Clean up URL parameters and redirect to auth page
                window.history.replaceState({}, document.title, window.location.pathname);
                navigate('/auth', { replace: true });
            }
        };

        handleOAuthCallback();
    }, [setUser, showToast, navigate]);
};

export default useOAuthCallback;
