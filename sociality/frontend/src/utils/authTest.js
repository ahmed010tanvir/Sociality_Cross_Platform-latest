// Authentication testing utility
import { getCurrentTabUser, validateAuthentication } from './api';

export const testAuthentication = async () => {
  console.log('=== AUTHENTICATION TEST ===');
  
  // Check local storage
  const tabUser = getCurrentTabUser();
  console.log('Tab user data:', tabUser);
  
  // Check session path
  const sessionPath = tabUser?.sessionPath;
  console.log('Session path:', sessionPath);
  
  // Test cookie endpoint
  try {
    const cookieResponse = await fetch(`/api/auth/debug/cookies${sessionPath ? `?session=${sessionPath}` : ''}`, {
      credentials: 'include'
    });
    const cookieData = await cookieResponse.json();
    console.log('Cookie debug response:', cookieData);
  } catch (error) {
    console.error('Cookie test failed:', error);
  }
  
  // Test OAuth user endpoint
  try {
    const userResponse = await fetch(`/api/auth/oauth/user${sessionPath ? `?session=${sessionPath}` : ''}`, {
      credentials: 'include'
    });
    console.log('OAuth user response status:', userResponse.status);
    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('OAuth user data:', userData);
    } else {
      const errorData = await userResponse.text();
      console.log('OAuth user error:', errorData);
    }
  } catch (error) {
    console.error('OAuth user test failed:', error);
  }
  
  // Test authentication validation
  try {
    const isValid = await validateAuthentication();
    console.log('Authentication validation result:', isValid);
  } catch (error) {
    console.error('Authentication validation failed:', error);
  }
  
  // Test complete-profile endpoint
  try {
    const profileResponse = await fetch(`/api/users/complete-profile${sessionPath ? `?session=${sessionPath}` : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', username: 'test123', bio: 'test' }),
      credentials: 'include'
    });
    console.log('Complete profile response status:', profileResponse.status);
    if (!profileResponse.ok) {
      const errorData = await profileResponse.text();
      console.log('Complete profile error:', errorData);
    }
  } catch (error) {
    console.error('Complete profile test failed:', error);
  }
  
  console.log('=== END AUTHENTICATION TEST ===');
};

// Quick test function for browser console
window.testAuth = testAuthentication;
