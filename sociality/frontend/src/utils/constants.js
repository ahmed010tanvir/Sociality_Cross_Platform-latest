/**
 * Application constants
 * Contains all constant values used throughout the application
 */

// API endpoints
export const API_ENDPOINTS = {
  LOGIN: "/api/users/login",
  SIGNUP: "/api/users/signup",
  LOGOUT: "/api/users/logout",
  GET_USER: "/api/users",
  UPDATE_USER: "/api/users/update",
  GET_POSTS: "/api/posts",
  CREATE_POST: "/api/posts/create",
  DELETE_POST: "/api/posts",
  LIKE_POST: "/api/posts/like",
  REPLY_POST: "/api/posts/reply",
  GET_MESSAGES: "/api/messages",
  SEND_MESSAGE: "/api/messages",
};

// Socket events
export const SOCKET_EVENTS = {
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  JOIN_ROOM: "joinRoom",
  LEAVE_ROOM: "leaveRoom",
  NEW_MESSAGE: "newMessage",
  NEW_NOTIFICATION: "newNotification",
  NEW_REPLY: "newReply",
};

// Local storage keys
export const STORAGE_KEYS = {
  USER: "user-threads",
  THEME: "chakra-ui-color-mode",
};

// Default values
export const DEFAULTS = {
  AVATAR: "https://bit.ly/broken-link",
  PAGE_SIZE: 10,
};

// Routes
export const ROUTES = {
  HOME: "/",
  AUTH: "/auth",
  PROFILE: "/:username",
  POST: "/:username/post/:pid",
  CHAT: "/chat",
  SETTINGS: "/settings",
  SEARCH: "/search",
  NOTIFICATIONS: "/notifications",
  UPDATE_PROFILE: "/update",
  PROFILE_SETUP: "/profile-setup",
};
