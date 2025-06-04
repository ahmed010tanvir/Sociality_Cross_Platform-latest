import { useState } from 'react';
import { Box, Button, Text, VStack, Code, Divider } from '@chakra-ui/react';
import { useRecoilValue } from 'recoil';
import { userAtom } from '../atoms';
import { getCurrentTabUser, fetchWithSession } from '../utils/api';
import { testAuthentication } from '../utils/authTest';

/**
 * Debug component to test authentication flow
 * This can be temporarily added to help debug auth issues
 */
const AuthDebug = () => {
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const user = useRecoilValue(userAtom);

  const runAuthTest = async () => {
    setLoading(true);
    try {
      // Clear previous debug info
      setDebugInfo(null);

      // Run comprehensive authentication test
      await testAuthentication();

      // Collect results for display
      const tabUser = getCurrentTabUser();
      const sessionPath = tabUser?.sessionPath || '';

      // Test cookie endpoint
      const response = await fetch(`/api/auth/debug/cookies${sessionPath ? `?session=${sessionPath}` : ''}`, {
        credentials: 'include'
      });
      const cookieData = await response.json();

      // Test OAuth user endpoint
      const userResponse = await fetch(`/api/auth/oauth/user${sessionPath ? `?session=${sessionPath}` : ''}`, {
        credentials: 'include'
      });

      let userData = null;
      if (userResponse.ok) {
        userData = await userResponse.json();
      } else {
        userData = { error: `HTTP ${userResponse.status}`, message: await userResponse.text() };
      }

      // Test protected route
      const protectedResponse = await fetchWithSession('/api/users/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', username: 'test123', bio: 'test' })
      });

      setDebugInfo({
        tabUser,
        sessionPath,
        cookieData,
        userData,
        protectedStatus: protectedResponse.status,
        protectedOk: protectedResponse.ok,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      setDebugInfo({
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const clearDebugInfo = () => {
    setDebugInfo(null);
  };

  return (
    <Box p={4} border="1px solid" borderColor="gray.300" borderRadius="md" maxW="600px">
      <Text fontSize="lg" fontWeight="bold" mb={4}>
        Authentication Debug Tools
      </Text>
      
      <VStack spacing={3} align="stretch">
        <Text fontSize="sm">
          <strong>Current User (Recoil):</strong> {user ? user.username || user.email : 'None'}
        </Text>
        
        <Text fontSize="sm">
          <strong>Tab User:</strong> {getCurrentTabUser()?.username || 'None'}
        </Text>
        
        <Text fontSize="sm">
          <strong>Session Path:</strong> {getCurrentTabUser()?.sessionPath || 'None'}
        </Text>
        
        <Divider />
        
        <Button
          onClick={runAuthTest}
          colorScheme="blue"
          size="sm"
          isLoading={loading}
          loadingText="Testing..."
        >
          Run Authentication Test
        </Button>
        
        <Button 
          onClick={clearDebugInfo} 
          colorScheme="red" 
          size="sm" 
          variant="outline"
        >
          Clear Results
        </Button>
      </VStack>

      {debugInfo && (
        <Box mt={4} p={3} bg="gray.50" borderRadius="md" maxH="400px" overflowY="auto">
          <Text fontWeight="bold" mb={2}>Debug Results:</Text>
          <Code display="block" whiteSpace="pre-wrap" fontSize="xs">
            {JSON.stringify(debugInfo, null, 2)}
          </Code>
        </Box>
      )}
    </Box>
  );
};

export default AuthDebug;
