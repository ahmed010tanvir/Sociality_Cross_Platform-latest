/**
 * Socket service
 * Centralized service for socket.io operations
 */
import io from "socket.io-client";

// Socket instance cache
let socketInstance = null;

// Connection status
let connectionStatus = 'disconnected';

// Event listeners registry to avoid duplicate listeners
const eventListeners = new Map();

/**
 * Initialize socket connection
 * @param {string} userId - User ID for authentication
 * @returns {object} - Socket instance and connection methods
 */
export const initializeSocket = (userId) => {
  // Don't create a socket connection if there's no user ID
  if (!userId) {
    console.log("No user ID provided, not creating socket connection");
    return { socket: null, status: 'disconnected' };
  }

  // Temporarily disable socket.io for serverless deployment
  const isProduction = import.meta.env.PROD;
  if (isProduction) {
    console.log("Socket.io disabled in production (serverless environment)");
    return { socket: null, status: 'disabled' };
  }

  // If socket already exists and is connected, return it
  if (socketInstance && socketInstance.connected) {
    console.log("Reusing existing socket connection:", socketInstance.id);
    return {
      socket: socketInstance,
      status: connectionStatus
    };
  }

  // Determine socket URL based on environment
  const socketUrl = isProduction
    ? (import.meta.env.VITE_SOCKET_URL || window.location.origin) // Use current Vercel deployment URL
    : '/'; // Use relative URL for Vite proxy in development

  console.log("Creating new socket connection to:", socketUrl, isProduction ? "(production)" : "(via proxy)");

  // Create new socket instance with production-optimized configuration
  socketInstance = io(socketUrl, {
    query: { userId },
    reconnection: true,
    reconnectionAttempts: 3, // Reduced for faster failure in serverless
    reconnectionDelay: 2000, // Increased delay for serverless
    reconnectionDelayMax: 10000,
    timeout: 20000, // Increased timeout for serverless cold starts
    transports: isProduction ? ['polling'] : ['polling', 'websocket'], // Polling-only in production
    upgrade: false, // Disable upgrade in production to avoid WebSocket issues
    forceNew: false,
    autoConnect: true,
    // Additional production settings
    ...(isProduction && {
      withCredentials: true,
      extraHeaders: {
        'Access-Control-Allow-Credentials': 'true'
      }
    })
  });

  // Add event listeners for debugging
  socketInstance.on('connect', () => {
    console.log("Socket connected in socketService:", socketInstance.id);
    connectionStatus = 'connected';
  });

  socketInstance.on('connect_error', (error) => {
    console.error("Socket connection error in socketService:", error.message);
    console.error("Error details:", error);
    connectionStatus = 'error';
  });

  socketInstance.on('disconnect', (reason) => {
    console.log("Socket disconnected in socketService:", reason);
    connectionStatus = 'disconnected';
  });

  socketInstance.on('reconnect', (attemptNumber) => {
    console.log("Socket reconnected after", attemptNumber, "attempts");
    connectionStatus = 'connected';
  });

  socketInstance.on('reconnect_error', (error) => {
    console.error("Socket reconnection error:", error.message);
    connectionStatus = 'error';
  });

  // Update connection status
  connectionStatus = 'connecting';

  return {
    socket: socketInstance,
    status: connectionStatus
  };
};

/**
 * Register socket event listener with deduplication
 * @param {object} socket - Socket.io instance
 * @param {string} event - Event name
 * @param {function} callback - Event callback
 */
export const registerSocketEvent = (socket, event, callback) => {
  if (!socket) return;

  // Create unique key for this event + callback combination
  const callbackKey = `${event}_${callback.toString()}`;

  // Remove existing listener for this event + callback if exists
  if (eventListeners.has(callbackKey)) {
    socket.off(event, eventListeners.get(callbackKey));
    eventListeners.delete(callbackKey);
  }

  // Register new listener
  socket.on(event, callback);
  eventListeners.set(callbackKey, callback);
};

/**
 * Emit socket event with retry logic
 * @param {object} socket - Socket.io instance
 * @param {string} event - Event name
 * @param {any} data - Event data
 * @param {function} callback - Optional acknowledgement callback
 * @returns {Promise} - Resolves when event is sent or rejects on error
 */
export const emitSocketEvent = (socket, event, data, callback = null) => {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {

      reject(new Error('Socket not connected'));
      return;
    }

    try {
      if (callback) {
        socket.emit(event, data, callback);
      } else {
        socket.emit(event, data);
      }
      resolve();
    } catch (error) {

      reject(error);
    }
  });
};

/**
 * Disconnect socket and clean up resources
 */
export const disconnectSocket = () => {
  if (socketInstance) {

    socketInstance.disconnect();
    socketInstance.removeAllListeners();
    socketInstance = null;
    connectionStatus = 'disconnected';
    eventListeners.clear();
  }
};

/**
 * Get current socket instance
 * @returns {object|null} - Current socket instance or null
 */
export const getSocketInstance = () => socketInstance;

/**
 * Get current connection status
 * @returns {string} - Connection status
 */
export const getConnectionStatus = () => connectionStatus;

/**
 * Update connection status
 * @param {string} status - New connection status
 */
export const updateConnectionStatus = (status) => {
  connectionStatus = status;
};
