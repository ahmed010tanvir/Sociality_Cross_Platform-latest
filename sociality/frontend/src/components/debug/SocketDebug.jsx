import { Box, Text, Badge, VStack, Heading, Code } from "@chakra-ui/react";
import { useSocket } from "../../hooks/useSocket";
import { useEffect, useState } from "react";

/**
 * Socket Debug Component
 * Displays socket connection status and recent events
 * Only visible in development mode
 */
const SocketDebug = () => {
  const { socket, connectionStatus, connectionInfo } = useSocket();
  const [events, setEvents] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  // Toggle visibility with keyboard shortcut (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for socket events
  useEffect(() => {
    if (!socket) return;

    const handlePostUpdate = (data) => {
      setEvents(prev => [{
        type: 'postUpdate',
        data: JSON.stringify(data),
        time: new Date().toLocaleTimeString()
      }, ...prev.slice(0, 9)]);
    };

    const handleNewReply = (data) => {
      setEvents(prev => [{
        type: 'newReply',
        data: JSON.stringify(data),
        time: new Date().toLocaleTimeString()
      }, ...prev.slice(0, 9)]);
    };

    const handleConnect = () => {
      setEvents(prev => [{
        type: 'connect',
        data: 'Socket connected',
        time: new Date().toLocaleTimeString()
      }, ...prev.slice(0, 9)]);
    };

    const handleDisconnect = (reason) => {
      setEvents(prev => [{
        type: 'disconnect',
        data: `Socket disconnected: ${reason}`,
        time: new Date().toLocaleTimeString()
      }, ...prev.slice(0, 9)]);
    };

    // Register event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('postUpdate', handlePostUpdate);
    socket.on('newReply', handleNewReply);

    // Clean up event listeners
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('postUpdate', handlePostUpdate);
      socket.off('newReply', handleNewReply);
    };
  }, [socket]);

  if (!isVisible) return null;

  return (
    <Box
      position="fixed"
      bottom="20px"
      right="20px"
      bg="rgba(0, 0, 0, 0.8)"
      color="white"
      p={4}
      borderRadius="md"
      zIndex={9999}
      maxW="400px"
      maxH="400px"
      overflowY="auto"
      boxShadow="0 0 10px rgba(0, 0, 0, 0.5)"
      borderWidth="1px"
      borderColor="gray.700"
    >
      <VStack align="start" spacing={3}>
        <Heading size="sm">Socket Debug (Ctrl+Shift+D to toggle)</Heading>
        
        <Box>
          <Text fontSize="xs">Status: 
            <Badge 
              ml={2} 
              colorScheme={
                connectionStatus === 'connected' ? 'green' : 
                connectionStatus === 'connecting' ? 'yellow' : 'red'
              }
            >
              {connectionStatus}
            </Badge>
          </Text>
          {connectionInfo && (
            <Text fontSize="xs" color="red.300" mt={1}>{connectionInfo}</Text>
          )}
          <Text fontSize="xs" mt={1}>
            Socket ID: {socket?.id || 'Not connected'}
          </Text>
        </Box>

        <Box w="100%">
          <Text fontSize="xs" fontWeight="bold" mb={1}>Recent Events:</Text>
          {events.length === 0 ? (
            <Text fontSize="xs" color="gray.400">No events yet</Text>
          ) : (
            events.map((event, index) => (
              <Box 
                key={index} 
                p={2} 
                bg="gray.800" 
                borderRadius="sm" 
                mb={1}
                fontSize="xs"
              >
                <Text fontWeight="bold" color={
                  event.type === 'connect' ? 'green.300' :
                  event.type === 'disconnect' ? 'red.300' :
                  event.type === 'postUpdate' ? 'blue.300' :
                  event.type === 'newReply' ? 'purple.300' : 'white'
                }>
                  {event.time} - {event.type}
                </Text>
                <Code 
                  fontSize="10px" 
                  p={1} 
                  mt={1} 
                  bg="gray.900" 
                  w="100%" 
                  overflowX="auto"
                  display="block"
                  whiteSpace="pre-wrap"
                >
                  {event.data}
                </Code>
              </Box>
            ))
          )}
        </Box>
      </VStack>
    </Box>
  );
};

export default SocketDebug;
