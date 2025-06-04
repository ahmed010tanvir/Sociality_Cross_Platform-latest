import { useState } from 'react';
import { Box, Button, VStack, Text, Alert, AlertIcon, Code, Divider } from '@chakra-ui/react';
import { googleOAuthPopup, testPopupAllowed } from '../utils/oauthPopup';

/**
 * OAuth Test Page - for debugging OAuth popup flow
 * This page helps test and debug the OAuth popup authentication
 */
const OAuthTestPage = () => {
  const [testResults, setTestResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const addTestResult = (test, result, details = '') => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [...prev, { test, result, details, timestamp }]);
  };

  const runPopupTest = () => {
    const allowed = testPopupAllowed();
    addTestResult('Popup Allowed Test', allowed ? 'PASS' : 'FAIL', 
      allowed ? 'Popups are allowed' : 'Popups are blocked');
  };

  const testWindowOpener = () => {
    const popup = window.open('about:blank', 'test', 'width=300,height=200');
    if (popup) {
      const hasOpener = !!popup.opener;
      addTestResult('Window Opener Test', hasOpener ? 'PASS' : 'FAIL',
        hasOpener ? 'window.opener is available' : 'window.opener is null');
      popup.close();
    } else {
      addTestResult('Window Opener Test', 'FAIL', 'Could not open popup');
    }
  };

  const testLocalStorage = () => {
    try {
      const testKey = 'oauth_test_' + Date.now();
      const testValue = { test: true, timestamp: Date.now() };
      localStorage.setItem(testKey, JSON.stringify(testValue));
      const retrieved = JSON.parse(localStorage.getItem(testKey));
      localStorage.removeItem(testKey);
      
      const success = retrieved && retrieved.test === true;
      addTestResult('LocalStorage Test', success ? 'PASS' : 'FAIL',
        success ? 'LocalStorage read/write works' : 'LocalStorage failed');
    } catch (error) {
      addTestResult('LocalStorage Test', 'FAIL', `Error: ${error.message}`);
    }
  };

  const testBroadcastChannel = () => {
    try {
      const channel = new BroadcastChannel('test_channel');
      channel.postMessage({ test: true });
      channel.close();
      addTestResult('BroadcastChannel Test', 'PASS', 'BroadcastChannel is available');
    } catch (error) {
      addTestResult('BroadcastChannel Test', 'FAIL', `Error: ${error.message}`);
    }
  };

  const testOAuthFlow = async () => {
    setIsLoading(true);
    addTestResult('OAuth Flow Test', 'RUNNING', 'Starting OAuth popup flow...');
    
    try {
      const userData = await googleOAuthPopup(false);
      addTestResult('OAuth Flow Test', 'PASS', `Success: ${userData.name || userData.email}`);
    } catch (error) {
      addTestResult('OAuth Flow Test', 'FAIL', `Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const runAllTests = () => {
    clearResults();
    runPopupTest();
    testWindowOpener();
    testLocalStorage();
    testBroadcastChannel();
  };

  return (
    <Box maxW="800px" mx="auto" p={6}>
      <VStack spacing={6} align="stretch">
        <Box>
          <Text fontSize="2xl" fontWeight="bold" mb={4}>
            OAuth Popup Test Page
          </Text>
          <Text color="gray.600" mb={4}>
            This page helps debug OAuth popup authentication issues in production.
          </Text>
        </Box>

        <Divider />

        <VStack spacing={3} align="stretch">
          <Text fontSize="lg" fontWeight="semibold">Quick Tests</Text>
          
          <Box display="flex" gap={3} flexWrap="wrap">
            <Button onClick={runAllTests} colorScheme="blue" size="sm">
              Run All Tests
            </Button>
            <Button onClick={runPopupTest} size="sm">
              Test Popup Allowed
            </Button>
            <Button onClick={testWindowOpener} size="sm">
              Test Window Opener
            </Button>
            <Button onClick={testLocalStorage} size="sm">
              Test LocalStorage
            </Button>
            <Button onClick={testBroadcastChannel} size="sm">
              Test BroadcastChannel
            </Button>
            <Button onClick={clearResults} variant="outline" size="sm">
              Clear Results
            </Button>
          </Box>
        </VStack>

        <Divider />

        <VStack spacing={3} align="stretch">
          <Text fontSize="lg" fontWeight="semibold">OAuth Flow Test</Text>
          <Button 
            onClick={testOAuthFlow} 
            colorScheme="green" 
            isLoading={isLoading}
            loadingText="Testing OAuth..."
          >
            Test OAuth Popup Flow
          </Button>
        </VStack>

        <Divider />

        <VStack spacing={3} align="stretch">
          <Text fontSize="lg" fontWeight="semibold">Test Results</Text>
          
          {testResults.length === 0 ? (
            <Text color="gray.500" fontStyle="italic">
              No tests run yet. Click "Run All Tests" to start.
            </Text>
          ) : (
            <VStack spacing={2} align="stretch">
              {testResults.map((result, index) => (
                <Alert 
                  key={index} 
                  status={result.result === 'PASS' ? 'success' : result.result === 'FAIL' ? 'error' : 'info'}
                  variant="left-accent"
                >
                  <AlertIcon />
                  <Box flex="1">
                    <Text fontWeight="bold">
                      {result.test} - {result.result}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      {result.details}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {result.timestamp}
                    </Text>
                  </Box>
                </Alert>
              ))}
            </VStack>
          )}
        </VStack>

        <Divider />

        <VStack spacing={3} align="stretch">
          <Text fontSize="lg" fontWeight="semibold">Environment Info</Text>
          <Code p={3} borderRadius="md" fontSize="sm">
            <pre>{JSON.stringify({
              userAgent: navigator.userAgent,
              origin: window.location.origin,
              href: window.location.href,
              cookieEnabled: navigator.cookieEnabled,
              onLine: navigator.onLine,
              localStorage: typeof Storage !== 'undefined',
              broadcastChannel: typeof BroadcastChannel !== 'undefined',
              windowOpener: typeof window.opener !== 'undefined'
            }, null, 2)}</pre>
          </Code>
        </VStack>
      </VStack>
    </Box>
  );
};

export default OAuthTestPage;
