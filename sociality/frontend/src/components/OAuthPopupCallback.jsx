import { useEffect, useState } from 'react';
import { Box, Spinner, Text, VStack, Alert, AlertIcon } from '@chakra-ui/react';
import { handleOAuthPopupCallback } from '../utils/oauthPopup';

/**
 * OAuth Popup Callback Component
 * This component handles the OAuth callback in a popup window
 * and communicates the result back to the parent window
 */
const OAuthPopupCallback = () => {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('OAuthPopupCallback component mounted');
    console.log('Current URL:', window.location.href);
    console.log('URL params:', new URLSearchParams(window.location.search).toString());

    // Add a timeout to show error if callback takes too long
    const timeoutId = setTimeout(() => {
      if (status === 'processing') {
        setStatus('timeout');
        setError('Authentication is taking longer than expected');
      }
    }, 10000);

    try {
      // Handle the OAuth callback
      handleOAuthPopupCallback();

      // Monitor for successful completion
      const checkCompletion = setInterval(() => {
        // Check if localStorage has been set (indicating completion)
        const result = localStorage.getItem('oauth_popup_result');
        if (result) {
          try {
            const parsed = JSON.parse(result);
            if (parsed.type === 'OAUTH_SUCCESS') {
              setStatus('success');
            } else if (parsed.type === 'OAUTH_ERROR') {
              setStatus('error');
              setError(parsed.error);
            }
            clearInterval(checkCompletion);
          } catch (e) {
            console.warn('Failed to parse OAuth result:', e);
          }
        }
      }, 500);

      // Cleanup
      return () => {
        clearTimeout(timeoutId);
        clearInterval(checkCompletion);
      };
    } catch (error) {
      console.error('Error in OAuth callback component:', error);
      setStatus('error');
      setError(error.message);
      clearTimeout(timeoutId);
    }
  }, [status]);

  const renderContent = () => {
    switch (status) {
      case 'success':
        return (
          <VStack spacing={4}>
            <Text fontSize="2xl" color="green.500">✓</Text>
            <Text fontSize="lg" color="green.600">
              Authentication Successful!
            </Text>
            <Text fontSize="sm" color="gray.500">
              This window will close automatically
            </Text>
          </VStack>
        );

      case 'error':
        return (
          <VStack spacing={4}>
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              <Box>
                <Text fontWeight="bold">Authentication Failed</Text>
                <Text fontSize="sm">{error}</Text>
              </Box>
            </Alert>
            <Text fontSize="sm" color="gray.500">
              You can close this window
            </Text>
          </VStack>
        );

      case 'timeout':
        return (
          <VStack spacing={4}>
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              <Box>
                <Text fontWeight="bold">Taking longer than expected</Text>
                <Text fontSize="sm">Please wait or try refreshing</Text>
              </Box>
            </Alert>
            <Spinner size="lg" color="orange.500" />
          </VStack>
        );

      default:
        return (
          <VStack spacing={4}>
            <Spinner size="lg" color="teal.500" />
            <Text fontSize="lg" color="gray.600">
              Completing authentication...
            </Text>
            <Text fontSize="sm" color="gray.500">
              This window will close automatically
            </Text>
          </VStack>
        );
    }
  };

  return (
    <Box
      height="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="gray.50"
      p={4}
    >
      {renderContent()}
    </Box>
  );
};

export default OAuthPopupCallback;
