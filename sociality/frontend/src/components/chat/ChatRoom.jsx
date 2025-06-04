import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Flex, Text, Input, Button, Avatar, Spinner } from '@chakra-ui/react';
import { useRecoilValue } from 'recoil';
import { userAtom } from '../../atoms';
import { useSocketEvent, useSocketEmit, useSocketRoom } from '../../hooks';
import { handleNewMessage } from '../../utils/socketEventHandlers';

import useShowToast from '../../hooks/ui/useShowToast';

/**
 * Chat room component
 * Displays a chat room with real-time messaging
 */
const ChatRoom = ({ roomId, recipient }) => {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const currentUser = useRecoilValue(userAtom);
  const showToast = useShowToast();
  const messagesEndRef = useRef(null);

  
  // Use socket hooks
  const sendMessage = useSocketEmit('sendMessage');
  
  // Join the room
  useSocketRoom(roomId);
  
  // Listen for new messages
  useSocketEvent('newMessage', (data) => {
    if (data.roomId === roomId) {
      handleNewMessage(data, setMessages, null); // Don't show toast for messages in current room
    }
  });
  
  // Fetch message history
  const fetchMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/messages/${roomId}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setMessages(data);
    } catch (error) {
      showToast('Error', error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [roomId, showToast]);
  
  // Fetch messages when component mounts
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    console.log('🔄 ChatRoom auto-scroll triggered, messages count:', messages.length);

    const forceScrollToAbsoluteBottom = () => {
      const performScroll = () => {
        if (messagesEndRef.current) {
          const messagesContainer = messagesEndRef.current.parentElement;

          if (messagesContainer) {
            // Calculate scroll position with extra padding for complete visibility
            const extraBottomPadding = 40; // Extra space to ensure full message visibility
            const maxScroll = messagesContainer.scrollHeight - messagesContainer.clientHeight + extraBottomPadding;

            // Set scroll position to show complete last message with padding
            messagesContainer.scrollTop = Math.max(0, maxScroll);

            console.log('ChatRoom forced scrollTop with padding:', messagesContainer.scrollTop);
            console.log('ChatRoom scrollHeight:', messagesContainer.scrollHeight);
            console.log('ChatRoom clientHeight:', messagesContainer.clientHeight);
            console.log('ChatRoom extra padding applied:', extraBottomPadding);
          }

          // Also use scrollIntoView with additional bottom margin
          messagesEndRef.current.scrollIntoView({
            behavior: 'auto', // Changed to 'auto' for immediate scroll
            block: 'end',
            inline: 'nearest'
          });
        }
      };

      // Multiple scroll attempts with requestAnimationFrame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          performScroll();
          // Final scroll attempt to ensure complete visibility
          setTimeout(() => {
            performScroll();
            console.log('ChatRoom final scroll attempt for complete visibility');
          }, 300);
        });
      });
    };

    if (messages.length > 0) {
      forceScrollToAbsoluteBottom();
    }
  }, [messages]);


  
  // Handle sending a message
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    
    try {
      // Optimistically add message to UI
      const tempMessage = {
        _id: `temp-${Date.now()}`,
        sender: currentUser._id,
        recipient: recipient._id,
        text: messageText,
        createdAt: new Date().toISOString(),
        isTemp: true
      };
      
      setMessages(prev => [...prev, tempMessage]);
      setMessageText('');

      // Send message via socket
      await sendMessage({
        roomId,
        text: messageText,
        recipient: recipient._id
      });
    } catch (error) {
      showToast('Error', 'Failed to send message', 'error');
      
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => msg._id !== `temp-${Date.now()}`));
    }
  };
  
  return (
    <Box h="full" display="flex" flexDirection="column">
      {/* Chat header */}
      <Flex 
        p={4} 
        borderBottom="1px solid" 
        borderColor="gray.700"
        alignItems="center"
        bg="#101010"
      >
        <Avatar size="sm" src={recipient.profilePic} mr={3} />
        <Text fontWeight="bold">{recipient.username}</Text>
      </Flex>
      
      {/* Messages area */}
      <Box
        flex="1"
        p={4}
        display="flex"
        flexDirection="column"
        gap={2}
        overflowY="auto"
        style={{ minWidth: 0 }}
        className="message-container cross-platform-chat chat-room-container chat-messages-area"
      >
        {isLoading ? (
          <Flex justify="center" align="center" h="full">
            <Spinner size="lg" color="brand.primary.500" />
          </Flex>
        ) : messages.length === 0 ? (
          <Flex justify="center" align="center" h="full">
            <Text color="gray.500">No messages yet. Start the conversation!</Text>
          </Flex>
        ) : (
          <>
            {messages.map(message => (
              <Flex
                key={message._id}
                alignSelf={message.sender === currentUser._id ? "flex-end" : "flex-start"}
                maxW="70%"
                style={{ overflowWrap: "break-word", wordBreak: "break-word", minWidth: 0 }}
              >
                <Box
                  bg={message.sender === currentUser._id
                    ? "brand.primary.500"
                    : "gray.700"}
                  color="white"
                  p={3}
                  borderRadius="lg"
                  opacity={message.isTemp ? 0.7 : 1}
                >
                  <Text>{message.text}</Text>
                  <Text fontSize="xs" color="whiteAlpha.700" textAlign="right" mt={1}>
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </Box>
              </Flex>
            ))}
            {/* Invisible element for auto-scroll with bottom spacing */}
            <div ref={messagesEndRef} style={{ height: '20px', minHeight: '20px' }} />
          </>
        )}
      </Box>
      
      {/* Message input */}
      <Flex 
        p={4} 
        borderTop="1px solid" 
        borderColor="gray.700"
        bg="#101010"
      >
        <Input
          flex="1"
          mr={2}
          placeholder="Type a message..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          bg="gray.800"
          border="none"
          _focus={{ border: "none", boxShadow: "0 0 0 1px rgba(0, 204, 133, 0.3)" }}
        />
        <Button
          colorScheme="green"
          onClick={handleSendMessage}
          isDisabled={!messageText.trim()}
        >
          Send
        </Button>
      </Flex>
    </Box>
  );
};

export default ChatRoom;
