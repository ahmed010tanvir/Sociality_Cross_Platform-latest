/**
 * Hook for handling socket events
 */
import { useEffect, useRef } from 'react';
import { useSocket } from './useSocket';

/**
 * Custom hook to listen for socket events
 * @param {string} eventName - Name of the socket event to listen for
 * @param {function} callback - Callback function to handle the event
 * @param {array} dependencies - Dependencies array for the effect
 */
export const useSocketEvent = (eventName, callback, dependencies = []) => {
  const { socket, isConnected } = useSocket();
  const callbackRef = useRef(callback);

  // Update the callback ref when the callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Set up and clean up the event listener
  useEffect(() => {
    // Skip if socket is not connected or event name is not provided
    if (!socket || !isConnected || !eventName) return;

    // Create a handler that calls the latest callback
    const handler = (...args) => {
      callbackRef.current(...args);
    };

    // Register the event listener
    socket.on(eventName, handler);

    // Clean up the event listener
    return () => {
      socket.off(eventName, handler);
    };
  }, [socket, isConnected, eventName, ...dependencies]);
};

/**
 * Custom hook to emit socket events
 * @param {string} eventName - Name of the socket event to emit
 * @returns {function} - Function to emit the event with data
 */
export const useSocketEmit = (eventName) => {
  const { socket, isConnected, emit } = useSocket();

  // Return a function that emits the event
  return (data, callback) => {
    if (!socket || !isConnected || !eventName) {
      console.warn('Socket not connected or event name not provided');
      return Promise.reject(new Error('Socket not connected'));
    }

    return emit(eventName, data, callback);
  };
};

/**
 * Custom hook to join a socket room
 * @param {string} roomId - ID of the room to join
 * @param {array} dependencies - Dependencies array for the effect
 */
export const useSocketRoom = (roomId, dependencies = []) => {
  const { socket, isConnected, joinRoom, leaveRoom } = useSocket();

  // Join the room when the component mounts and leave when it unmounts
  useEffect(() => {
    // Skip if socket is not connected or room ID is not provided
    if (!socket || !isConnected || !roomId) return;

    // Join the room
    joinRoom(roomId);

    // Leave the room when the component unmounts
    return () => {
      leaveRoom(roomId);
    };
  }, [socket, isConnected, roomId, joinRoom, leaveRoom, ...dependencies]);
};
