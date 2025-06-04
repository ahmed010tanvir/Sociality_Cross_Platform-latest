/**
 * Onboarding route component
 * Redirects users with incomplete profiles to the profile setup page
 */
import { Navigate, useLocation } from "react-router-dom";
import { useRecoilValue } from "recoil";
import { userAtom } from "../atoms";
import { useEffect, useState } from "react";
import { Box, Spinner, Text, VStack } from "@chakra-ui/react";
import { fetchWithSession } from "../utils/api";

const OnboardingRoute = ({ children }) => {
  const user = useRecoilValue(userAtom);
  const location = useLocation();
  const [profileStatus, setProfileStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const checkProfileCompletion = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // Check if this is an OAuth callback - if so, skip profile completion check
      // to avoid race conditions with the OAuth callback handler
      const urlParams = new URLSearchParams(window.location.search);
      const isOAuthCallback = urlParams.get('oauth') === 'success';

      if (isOAuthCallback) {
        console.log('OnboardingRoute: OAuth callback detected, skipping profile completion check');
        setLoading(false);
        return;
      }

      try {
        const res = await fetchWithSession('/api/users/profile-completion');

        if (res.ok) {
          const data = await res.json();
          setProfileStatus(data);
          setError(false);
        } else {
          console.error('Failed to check profile completion:', res.status, res.statusText);
          setError(true);
          // If API fails, check user object directly as fallback
          if (user.hasOwnProperty('isProfileComplete')) {
            setProfileStatus({ isProfileComplete: user.isProfileComplete });
          }
        }
      } catch (error) {
        console.error('Error checking profile completion:', error);
        setError(true);
        // If API fails, check user object directly as fallback
        if (user.hasOwnProperty('isProfileComplete')) {
          setProfileStatus({ isProfileComplete: user.isProfileComplete });
        }
      } finally {
        setLoading(false);
      }
    };

    checkProfileCompletion();
  }, [user]);

  // Show loading spinner while checking profile status
  if (loading) {
    return (
      <Box
        height="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <VStack spacing={4}>
          <Spinner size="xl" color="teal.400" thickness="4px" />
          <Text color="gray.600">Checking profile status...</Text>
        </VStack>
      </Box>
    );
  }

  // If no user, let ProtectedRoute handle the redirect
  if (!user) {
    return children;
  }

  // Check if this is an OAuth callback - if so, let useOAuthCallback handle the routing
  const urlParams = new URLSearchParams(window.location.search);
  const isOAuthCallback = urlParams.get('oauth') === 'success';

  if (isOAuthCallback) {
    console.log('OnboardingRoute: OAuth callback detected, letting useOAuthCallback handle routing');
    return children;
  }

  // If we have an error and no profile status, assume incomplete for security
  if (error && !profileStatus) {
    console.warn('Profile completion check failed, redirecting to setup for security');
    if (location.pathname !== '/profile-setup') {
      return <Navigate to="/profile-setup" replace />;
    }
  }

  // CRITICAL: If profile is incomplete, ALWAYS redirect to profile setup
  // This prevents bypassing by manually navigating to any protected route
  if (profileStatus && !profileStatus.isProfileComplete) {
    if (location.pathname !== '/profile-setup') {
      console.log('Profile incomplete, redirecting to setup from:', location.pathname);
      return <Navigate to="/profile-setup" replace />;
    }
  }

  // If profile is complete and on profile setup page, redirect to home
  if (profileStatus && profileStatus.isProfileComplete && location.pathname === '/profile-setup') {
    console.log('Profile complete, redirecting to home from setup page');
    return <Navigate to="/" replace />;
  }

  // Only allow access if profile is complete OR user is on profile setup page
  if (profileStatus && !profileStatus.isProfileComplete && location.pathname !== '/profile-setup') {
    return <Navigate to="/profile-setup" replace />;
  }

  return children;
};

export default OnboardingRoute;
