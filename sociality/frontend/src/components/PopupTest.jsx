import { Button, VStack, Text, Box } from '@chakra-ui/react';
import { useState } from 'react';
import { testPopupAllowed } from '../utils/oauthPopup';

/**
 * Test component to debug popup functionality
 * This can be temporarily added to help debug popup issues
 */
const PopupTest = () => {
  const [testResults, setTestResults] = useState([]);

  const addResult = (test, result) => {
    setTestResults(prev => [...prev, { test, result, time: new Date().toLocaleTimeString() }]);
  };

  const testBasicPopup = () => {
    try {
      const popup = window.open('about:blank', 'test', 'width=300,height=200');
      if (popup) {
        addResult('Basic popup', 'SUCCESS - Popup opened');
        setTimeout(() => popup.close(), 1000);
      } else {
        addResult('Basic popup', 'FAILED - Popup blocked');
      }
    } catch (error) {
      addResult('Basic popup', `ERROR - ${error.message}`);
    }
  };

  const testPopupAllowedFunction = () => {
    const result = testPopupAllowed();
    addResult('testPopupAllowed()', result ? 'SUCCESS - Popups allowed' : 'FAILED - Popups blocked');
  };

  const testUserActivation = () => {
    const isActive = navigator.userActivation?.isActive;
    const hasBeenActive = navigator.userActivation?.hasBeenActive;
    addResult('User Activation', `Active: ${isActive}, Has been active: ${hasBeenActive}`);
  };

  const testOAuthURL = () => {
    try {
      const popup = window.open('/api/auth/google/popup', 'oauth_test', 'width=500,height=600');
      if (popup) {
        addResult('OAuth URL test', 'SUCCESS - OAuth popup opened');
        setTimeout(() => {
          if (!popup.closed) {
            popup.close();
          }
        }, 3000);
      } else {
        addResult('OAuth URL test', 'FAILED - OAuth popup blocked');
      }
    } catch (error) {
      addResult('OAuth URL test', `ERROR - ${error.message}`);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <Box p={4} border="1px solid" borderColor="gray.300" borderRadius="md" maxW="500px">
      <Text fontSize="lg" fontWeight="bold" mb={4}>
        Popup Debugging Tools
      </Text>
      
      <VStack spacing={3} align="stretch">
        <Button onClick={testBasicPopup} colorScheme="blue" size="sm">
          Test Basic Popup
        </Button>
        
        <Button onClick={testPopupAllowedFunction} colorScheme="green" size="sm">
          Test Popup Detection
        </Button>
        
        <Button onClick={testUserActivation} colorScheme="purple" size="sm">
          Check User Activation
        </Button>
        
        <Button onClick={testOAuthURL} colorScheme="orange" size="sm">
          Test OAuth URL
        </Button>
        
        <Button onClick={clearResults} colorScheme="red" size="sm" variant="outline">
          Clear Results
        </Button>
      </VStack>

      {testResults.length > 0 && (
        <Box mt={4} p={3} bg="gray.50" borderRadius="md">
          <Text fontWeight="bold" mb={2}>Test Results:</Text>
          {testResults.map((result, index) => (
            <Text key={index} fontSize="sm" mb={1}>
              <strong>{result.time}</strong> - {result.test}: {result.result}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default PopupTest;
