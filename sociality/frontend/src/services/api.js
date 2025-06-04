/**
 * API service
 * Centralized service for making API calls
 */

// Base API configuration
const API_BASE_URL = '/api';

/**
 * Generic API request function
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {object} data - Request body data
 * @returns {Promise} - API response
 */
const apiRequest = async (endpoint, method = 'GET', data = null) => {
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies for authentication
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Something went wrong');
  }

  return result;
};

// User API services
export const userService = {
  login: (credentials) => apiRequest('/users/login', 'POST', credentials),
  signup: (userData) => apiRequest('/users/signup', 'POST', userData),
  logout: () => apiRequest('/users/logout', 'POST'),
  getProfile: (username) => apiRequest(`/users/profile/${username}`),
  updateProfile: (userData) => apiRequest('/users/update', 'PUT', userData),
  followUser: (userId) => apiRequest(`/users/follow/${userId}`, 'POST'),
  unfollowUser: (userId) => apiRequest(`/users/follow/${userId}`, 'DELETE'),
  getSuggestedUsers: () => apiRequest('/users/suggested'),
  getFollowers: (userId) => apiRequest(`/users/${userId}/followers`),
  getFollowing: (userId) => apiRequest(`/users/${userId}/following`),
};

// Post API services
export const postService = {
  getPosts: () => apiRequest('/posts'),
  getPost: (postId) => apiRequest(`/posts/${postId}`),
  createPost: (postData) => apiRequest('/posts/create', 'POST', postData),
  deletePost: (postId) => apiRequest(`/posts/${postId}`, 'DELETE'),
  likePost: (postId) => apiRequest(`/posts/like/${postId}`, 'POST'),
  unlikePost: (postId) => apiRequest(`/posts/unlike/${postId}`, 'POST'),
  replyToPost: (postId, replyData) => apiRequest(`/posts/reply/${postId}`, 'POST', replyData),
  repostPost: (postId) => apiRequest(`/posts/repost/${postId}`, 'POST'),
  updatePost: (postId, postData) => apiRequest(`/posts/${postId}`, 'PUT', postData),
  getUserPosts: (username) => apiRequest(`/posts/user/${username}`),
  likeComment: (postId, commentId) => apiRequest(`/posts/comment/like/${postId}/${commentId}`, 'PUT'),
  replyToComment: (postId, commentId, replyData) => 
    apiRequest(`/posts/reply/${postId}/comment/${commentId}`, 'PUT', replyData),
  deleteComment: (postId, commentId) => apiRequest(`/posts/comment/${postId}/${commentId}`, 'DELETE'),
};

// Message API services
export const messageService = {
  getConversations: () => apiRequest('/messages'),
  getMessages: (userId) => apiRequest(`/messages/${userId}`),
  sendMessage: (messageData) => apiRequest('/messages', 'POST', messageData),
  deleteMessage: (messageId) => apiRequest(`/messages/${messageId}`, 'DELETE'),
};

// Notification API services
export const notificationService = {
  getNotifications: () => apiRequest('/notifications'),
  markAsRead: (notificationId) => apiRequest(`/notifications/${notificationId}/read`, 'PUT'),
  markAllAsRead: () => apiRequest('/notifications/read-all', 'PUT'),
};
