import { Avatar, Box, Flex, Skeleton, SkeletonCircle, Text, IconButton } from "@chakra-ui/react";

import Message from "./Message";
import MessageInput from "./MessageInput";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import useShowToast from "../hooks/useShowToast";
import { useRecoilValue } from "recoil";
import { userAtom, selectedConversationAtom } from "../atoms";
import { useSocket } from "../hooks/useSocket";
import messageSound from "../assets/sounds/message.mp3";

import { formatDistanceToNow } from "date-fns";
import { BsChatDots } from "react-icons/bs";
import { FaShare, FaTrash } from "react-icons/fa";
import { fetchWithSession } from "../utils/api";
import { FixedSizeList as List } from "react-window";

const MessageContainer = ({
	onShareRoom,
	onDeleteRoom
}) => {
	const showToast = useShowToast();
	const selectedConversation = useRecoilValue(selectedConversationAtom);
	const [loadingMessages, setLoadingMessages] = useState(true);
	const [messages, setMessages] = useState([]);
	const currentUser = useRecoilValue(userAtom);
	const { socket, isConnected, onlineUsers, userLastSeen, joinRoom, leaveRoom } = useSocket();
	const listRef = useRef(null);
	const containerRef = useRef(null);


	const [lastMessageTimestamp, setLastMessageTimestamp] = useState(null);
	const [pollingInterval, setPollingInterval] = useState(3000); // Start with 3s polling
	const [isTabActive, setIsTabActive] = useState(true);
	const [containerHeight, setContainerHeight] = useState(500); // Default height

	const [itemSize, setItemSize] = useState(90); // Default item size

	// Optimize back button click handler
	const handleBackClick = useCallback(() => {
		// Instead of window.history.back, always go to main message view
		const event = new CustomEvent('goToMainMessages');
		window.dispatchEvent(event);
	}, []);

	// Handler for new messages
	const handleNewMessage = useCallback((message) => {
		// Send acknowledgment to server
		if (socket && message._id) {
			socket.emit("messageReceived", { messageId: message._id });
		}

		// Only process messages for the current conversation
		if (selectedConversation._id === message.conversationId) {
			// Update the last message timestamp for polling fallback
			if (message.createdAt) {
				setLastMessageTimestamp(message.createdAt);
			}

			setMessages((prev) => {
				// Robust reconciliation: Replace optimistic message with real one if tempId matches
				const optimisticMessageIndex = prev.findIndex(msg => msg.tempId && (msg.tempId === message.tempId));
				if (optimisticMessageIndex !== -1) {
					const updatedMessages = [...prev];
					updatedMessages[optimisticMessageIndex] = {
						...message,
						isOptimistic: false,
						isNew: true,
						// Keep the original tempId for reference
						originalTempId: message.tempId
					};
					setTimeout(() => {
						setMessages(prevMsgs =>
							prevMsgs.map(msg => msg._id === message._id ? { ...msg, isNew: false } : msg)
						);
					}, 1000);
					return updatedMessages;
				}
				// Otherwise, add if not already present (by _id)
				const messageId = typeof message._id === 'string' ? message._id : String(message._id);
				const messageExists = prev.some(msg => {
					const msgId = typeof msg._id === 'string' ? msg._id : String(msg._id);
					if (msgId === messageId) return true;
					if (msg.text === message.text && msg.sender === message.sender && Math.abs(new Date(msg.createdAt) - new Date(message.createdAt)) < 5000) return true;
					return false;
				});
				if (!messageExists) {
					const newMessage = { ...message, isOptimistic: false, isNew: true };
					const updatedMessages = [...prev, newMessage];

					return updatedMessages;
				}
				return prev;
			});
		}
	}, [socket, selectedConversation._id]);

	// Handler for deleted messages
	const handleMessageDeleted = useCallback(({ messageId, deleteForEveryone }) => {
		if (deleteForEveryone) {
			// If deleted for everyone, update the message in UI
			setMessages(prev => prev.map(msg => {
				if (msg._id === messageId) {
					return { ...msg, deletedForEveryone: true };
				}
				return msg;
			}));
		}
	}, []);

	// Handler for messages seen
	const handleMessagesSeen = useCallback(({ conversationId }) => {
		if (selectedConversation._id === conversationId) {
			setMessages((prev) => {
				const updatedMessages = prev.map((message) => {
					if (!message.seen) {
						return {
							...message,
							seen: true,
						};
					}
					return message;
				});
				return updatedMessages;
			});
		}
	}, [selectedConversation._id]);

	// Handler for federated messages
	const handleFederatedMessage = useCallback((message) => {
		console.log('Received crossPlatformMessage event:', message);
		console.log('Current selected conversation:', selectedConversation);

		// Only process messages for the current federated room
		if (selectedConversation.isFederated && selectedConversation._id === message.roomId) {
			console.log('Processing federated message for current room');

			setMessages((prev) => {
				// Check if message already exists
				const messageExists = prev.some(msg =>
					msg._id === message.id ||
					(msg.text === message.text && msg.senderPlatform === message.sender?.platform &&
					Math.abs(new Date(msg.createdAt || msg.timestamp) - new Date(message.timestamp)) < 5000)
				);

				if (!messageExists) {
					const federatedMsg = {
						_id: message.id || Date.now().toString(),
						text: message.text,
						sender: message.sender?._id || message.sender?.id || 'unknown',
						senderUsername: message.sender?.username || 'Unknown User',
						senderPlatform: message.sender?.platform || 'unknown',
						createdAt: message.timestamp || new Date().toISOString(),
						isFederated: true,
						platform: message.platform || message.sender?.platform || 'unknown',
						isNew: true
					};

					console.log('Adding new federated message:', federatedMsg);

					// Remove animation class after animation completes
					setTimeout(() => {
						setMessages(prevMsgs =>
							prevMsgs.map(msg => msg._id === federatedMsg._id ? { ...msg, isNew: false } : msg)
						);
					}, 1000);

					return [...prev, federatedMsg];
				} else {
					console.log('Message already exists, skipping');
				}
				return prev;
			});

			// Play message sound for federated messages (only if not from current user)
			if (message.sender?._id !== currentUser._id) {
				try {
					const sound = new Audio(messageSound);
					sound.volume = 0.3;
					sound.play().catch(e => console.log('Could not play sound:', e));
				} catch (error) {
					console.log('Audio not supported');
				}
			}
		} else {
			console.log('Ignoring message - not for current federated room or not in federated mode');
		}
	}, [selectedConversation, currentUser._id]);

	// Function to handle message deletion
	const handleDeleteMessage = useCallback(async (messageId, deleteForEveryone = false) => {
		try {
			// Optimistic update
			if (deleteForEveryone) {
				setMessages(prev => prev.map(msg => {
					if (msg._id === messageId) {
						return { ...msg, deletedForEveryone: true };
					}
					return msg;
				}));
			} else {
				// Remove message from current user's view only
				setMessages(prev => prev.filter(msg => msg._id !== messageId));
			}

			// API call to delete message
			const res = await fetchWithSession(`/api/messages/${messageId}`, {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ deleteForEveryone }),
			});

			const data = await res.json();

			if (data.error) {
				showToast("Error", data.error, "error");
				// Revert changes on error
				setMessages(messages);
			}
		} catch (error) {
			showToast("Error", error.message, "error");
			// Revert changes on error
			setMessages(messages);
		}
	}, [messages, showToast]);

	// Format message timestamp
	const formatMessageTime = useCallback((timestamp) => {
		const date = new Date(timestamp);
		const now = new Date();
		const yesterday = new Date(now);
		yesterday.setDate(yesterday.getDate() - 1);

		// Same day, just show time
		if (date.toDateString() === now.toDateString()) {
			return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
		}
		// Yesterday
		else if (date.toDateString() === yesterday.toDateString()) {
			return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
		}
		// Different day, show date and time
		else {
			return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
		}
	}, []);

	// Determine if timestamp should be displayed
	const shouldDisplayTimestamp = useCallback((currentMsg, previousMsg) => {
		if (!previousMsg) return true;

		const currentTime = new Date(currentMsg.createdAt);
		const prevTime = new Date(previousMsg.createdAt);

		// Display timestamp if messages are more than 15 minutes apart
		const timeDiff = currentTime - prevTime;
		return timeDiff > 15 * 60 * 1000; // 15 minutes in milliseconds
	}, []);

	// Memoize the empty message state for better performance
	const emptyMessageState = useMemo(() => (
		<Flex direction="column" align="center" justify="center" h="100%" py={10}>
			<Box
				p={5}
				borderRadius="xl"
				bg="rgba(30, 30, 30, 0.3)"
				backdropFilter="blur(5px)"
				boxShadow="0 4px 12px rgba(0, 0, 0, 0.1)"
				border="1px solid rgba(255, 255, 255, 0.05)"
				maxW="400px"
				textAlign="center"
			>
				<Box
					mb={4}
					p={4}
					borderRadius="full"
					bg="rgba(0, 204, 133, 0.1)"
					display="inline-block"
				>
					<BsChatDots size={30} color="#00CC85" />
				</Box>
				<Text color="white" fontWeight="medium" fontSize="lg" mb={2}>
					No messages yet
				</Text>
				<Text color="gray.400" fontSize="sm">
					Start the conversation by sending a message below!
				</Text>
			</Box>
		</Flex>
	), []);

	// Memoize the loading skeletons to prevent unnecessary re-renders
	const loadingSkeletons = useMemo(() => (
		<>
			{[...Array(5)].map((_, i) => (
				<Flex
					key={i}
					gap={3}
					alignItems={"center"}
					p={2}
					borderRadius={"lg"}
					alignSelf={i % 2 === 0 ? "flex-start" : "flex-end"}
					opacity={0}
					animation={`fadeIn 0.3s ease-out ${i * 0.1}s forwards`}
					maxW="70%"
				>
					{i % 2 === 0 && (
						<SkeletonCircle
							size={8}
							startColor="#1E1E1E"
							endColor="#151515"
							borderRadius="full"
							boxShadow="0 0 3px rgba(0, 204, 133, 0.1)"
						/>
					)}
					<Flex
						flexDir={"column"}
						gap={2}
						bg={i % 2 === 0 ? "rgba(30, 30, 30, 0.5)" : "rgba(0, 56, 56, 0.15)"}
						p={3}
						borderRadius="lg"
						boxShadow="0 1px 3px rgba(0, 0, 0, 0.1)"
						minW="150px"
					>
						<Skeleton h='10px' w={`${150 + Math.random() * 100}px`} startColor={i % 2 === 0 ? "#1E1E1E" : "#003838"} endColor={i % 2 === 0 ? "#151515" : "#002828"} borderRadius="full" />
						<Skeleton h='10px' w={`${100 + Math.random() * 150}px`} startColor={i % 2 === 0 ? "#1E1E1E" : "#003838"} endColor={i % 2 === 0 ? "#151515" : "#002828"} borderRadius="full" />
						{Math.random() > 0.5 && <Skeleton h='10px' w={`${50 + Math.random() * 100}px`} startColor={i % 2 === 0 ? "#1E1E1E" : "#003838"} endColor={i % 2 === 0 ? "#151515" : "#002828"} borderRadius="full" />}
					</Flex>
					{i % 2 !== 0 && (
						<SkeletonCircle
							size={8}
							startColor="#1E1E1E"
							endColor="#151515"
							borderRadius="full"
							boxShadow="0 0 3px rgba(0, 204, 133, 0.1)"
						/>
					)}
				</Flex>
			))}
		</>
	), []);

	// Virtualized message list item renderer
	const MessageRow = useCallback(({ index, style, data }) => {
		const { messages, currentUser, handleDeleteMessage, shouldDisplayTimestamp, formatMessageTime } = data;
		const message = messages[index];
		const previousMessage = index > 0 ? messages[index - 1] : null;
		const showTimestamp = shouldDisplayTimestamp(message, previousMessage);

		return (
			<div style={style}>
				<Flex direction={"column"} className={message.isNew ? "message-new" : ""} style={message.animationDelay ? { animationDelay: message.animationDelay } : {}}>
					{/* Display timestamp if needed */}
					{showTimestamp && (
						<Flex justify="center" my={3}>
							<Text fontSize="xs" color="gray.500" bg="rgba(30, 30, 30, 0.7)" px={3} py={1} borderRadius="full">
								{formatMessageTime(message.createdAt)}
							</Text>
						</Flex>
					)}
					<Message
						message={message}
						ownMessage={currentUser._id === message.sender}
						onDelete={handleDeleteMessage}
					/>
				</Flex>
			</div>
		);
	}, []);

	// --- DYNAMIC HEIGHT CALCULATION ---
	useEffect(() => {
		const updateContainerHeight = () => {
			if (containerRef.current) {
				const containerRect = containerRef.current.getBoundingClientRect();
				setContainerHeight(containerRect.height);

				// Adjust item size based on container height for better responsiveness
				const baseItemSize = 90; // Default size
				const screenHeight = window.innerHeight;

				// Make items smaller on smaller screens
				if (screenHeight < 600) {
					setItemSize(baseItemSize * 0.7); // 70% of base size
				} else if (screenHeight < 900) {
					setItemSize(baseItemSize * 0.85); // 85% of base size
				} else {
					setItemSize(baseItemSize);
				}
			}
		};

		// Initial calculation
		updateContainerHeight();

		// Recalculate on window resize
		window.addEventListener('resize', updateContainerHeight);

		return () => {
			window.removeEventListener('resize', updateContainerHeight);
		};
	}, [selectedConversation._id]);









	useEffect(() => {
		// Debug: Log selectedConversation whenever it changes
		console.log("MessageContainer loaded for conversation:", selectedConversation);
	}, [selectedConversation]);

	// Debug: Log messages array whenever it changes
	useEffect(() => {
		console.log('Current messages array:', messages);
	}, [messages]);

	// Track if tab is active to adjust polling frequency
	useEffect(() => {
		const handleVisibilityChange = () => {
			const isVisible = document.visibilityState === 'visible';
			setIsTabActive(isVisible);
			// Use more frequent polling when tab is visible
			setPollingInterval(isVisible ? 3000 : 10000);
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	}, []);

	useEffect(() => {
		// Update the last message timestamp when messages change
		if (messages.length > 0) {
			const lastMsg = messages[messages.length - 1];
			setLastMessageTimestamp(lastMsg.createdAt);
		}
	}, [messages]);

	useEffect(() => {
		// Don't set up listeners if socket is not available
		if (!socket) return;

		// Set up socket event listeners
		socket.on("newMessage", handleNewMessage);
		socket.on("messageDeleted", handleMessageDeleted);
		socket.on("messagesSeen", handleMessagesSeen);
		socket.on("crossPlatformMessage", handleFederatedMessage);

		// Clean up socket event listeners
		return () => {
			socket.off("newMessage", handleNewMessage);
			socket.off("messageDeleted", handleMessageDeleted);
			socket.off("messagesSeen", handleMessagesSeen);
			socket.off("crossPlatformMessage", handleFederatedMessage);
		};
	}, [socket, selectedConversation._id, selectedConversation.userId, currentUser._id, handleNewMessage, handleMessageDeleted, handleMessagesSeen, handleFederatedMessage]);

	// Set up polling as a backup to ensure message delivery only when socket is not connected
	useEffect(() => {
		// Only poll if the conversation is selected and not a mock
		if (!selectedConversation._id || selectedConversation.mock) return;

		// Skip polling for federated rooms - they use socket events for real-time updates
		if (selectedConversation.isFederated) return;

		// Skip polling if socket is connected - rely on real-time updates instead
		if (isConnected) {
			return;
		}

		let isPolling = false; // Flag to prevent overlapping polls
		let consecutiveEmptyPolls = 0; // Track consecutive polls with no new messages

		const messagePollingInterval = setInterval(async () => {
			// Skip if socket is now connected
			if (isConnected) {
				return;
			}

			// Skip if already polling
			if (isPolling) {
				return;
			}

			// Adaptive polling - reduce frequency if we're not finding messages
			if (consecutiveEmptyPolls > 5 && !isTabActive) {
				// If we've had 5+ empty polls and tab is inactive, only poll occasionally
				if (Math.random() > 0.3) return; // 70% chance to skip polling when inactive
			}

			isPolling = true;

			try {
				// Only poll for messages newer than our most recent one
				const timestampParam = lastMessageTimestamp
					? `?since=${new Date(lastMessageTimestamp).toISOString()}`
					: '';

				const res = await fetchWithSession(`/api/messages/${selectedConversation.userId}${timestampParam}`);
				if (!res.ok) {
					isPolling = false;
					return;
				}

				const newMessages = await res.json();

				if (newMessages.length > 0) {
					// Reset counter when we find messages
					consecutiveEmptyPolls = 0;

					// Only log if we actually found messages (reduces console spam)
					console.log("Polling found new messages:", newMessages.length);

					// Add new messages if they don't already exist
					setMessages(prev => {
						const existingIds = new Set(prev.map(msg =>
							// Consider both _id and tempId to avoid duplicates
							typeof msg._id === 'string' ? msg._id : String(msg._id)
						));

						const uniqueNewMessages = newMessages
							.filter(msg => !existingIds.has(typeof msg._id === 'string' ? msg._id : String(msg._id)))
							.map(msg => ({ ...msg, isNew: true })); // Add animation class

						if (uniqueNewMessages.length > 0) {
							// Remove animation class after animation completes
							setTimeout(() => {
								setMessages(prevMsgs =>
									prevMsgs.map(msg => msg.isNew ? { ...msg, isNew: false } : msg)
								);
							}, 1000);

							return [...prev, ...uniqueNewMessages];
						}
						return prev;
					});

					// Mark new messages as seen if they're from the other user
					if (socket && newMessages.some(msg => msg.sender !== currentUser._id)) {
						socket.emit("markMessagesAsSeen", {
							conversationId: selectedConversation._id,
							userId: selectedConversation.userId,
						});
					}
				} else {
					// Increment counter when no messages found
					consecutiveEmptyPolls++;
				}
			} catch (error) {
				console.error("Error polling for messages:", error);
			} finally {
				isPolling = false;
			}
		}, pollingInterval);

		// Clean up polling interval
		return () => {
			clearInterval(messagePollingInterval);
		};
	}, [selectedConversation._id, selectedConversation.userId, selectedConversation.mock, selectedConversation.isFederated, currentUser._id, lastMessageTimestamp, pollingInterval, isTabActive, socket, isConnected]);

	useEffect(() => {
		// Don't proceed if socket is not available
		if (!socket) return;

		// Mark messages as seen when conversation is active and there are messages from other users
		const lastMessageIsFromOtherUser = messages.length && messages[messages.length - 1].sender !== currentUser._id;
		if (lastMessageIsFromOtherUser && selectedConversation._id) {
			socket.emit("markMessagesAsSeen", {
				conversationId: selectedConversation._id,
				userId: selectedConversation.userId,
			});
		}
	}, [socket, currentUser._id, messages, selectedConversation._id, selectedConversation.userId]);

	// Handle socket room joining/leaving for federated rooms
	useEffect(() => {
		if (!socket || !selectedConversation?.isFederated) {
			console.log('Skipping room join - no socket or not federated room');
			return;
		}

		const roomId = selectedConversation._id;
		if (roomId) {
			// Join the socket room for real-time cross-platform messages
			console.log(`Attempting to join socket room: room_${roomId}`);
			joinRoom(roomId).then(() => {
				console.log(`Successfully joined socket room: room_${roomId}`);
			}).catch((error) => {
				console.error(`Failed to join socket room: room_${roomId}`, error);
			});

			// Leave the room when conversation changes or component unmounts
			return () => {
				console.log(`Leaving socket room: room_${roomId}`);
				leaveRoom(roomId);
			};
		}
	}, [socket, selectedConversation?.isFederated, selectedConversation?._id, joinRoom, leaveRoom]);

	// Prevent fetching messages with undefined userId or handle federated rooms
	useEffect(() => {
		if (!selectedConversation || (!selectedConversation.userId && !selectedConversation.isFederated)) {
			setMessages([]);
			setLoadingMessages(false);
			return;
		}
		getMessages();
		// eslint-disable-next-line
	}, [selectedConversation]);

	// Auto-scroll to bottom when messages change
useEffect(() => {
  const forceScrollToAbsoluteBottom = () => {
    const performScroll = () => {
      if (containerRef.current) {
        const container = containerRef.current;

        // Calculate the maximum scroll position with extra padding for complete visibility
        const extraBottomPadding = 50; // Extra space to ensure full message visibility
        const maxScroll = container.scrollHeight - container.clientHeight + extraBottomPadding;

        // Set scroll position to show complete last message with padding
        container.scrollTop = Math.max(0, maxScroll);
      }

      // Also scroll the React Window list to the very end
      if (listRef.current && messages.length > 0) {
        // Use 'end' alignment to ensure the last item is fully visible at the bottom
        listRef.current.scrollToItem(messages.length - 1, 'end');

        // Additional manual scroll adjustment for react-window
        setTimeout(() => {
          if (listRef.current && listRef.current._outerRef) {
            const listContainer = listRef.current._outerRef;
            const extraPadding = 30; // Additional padding for react-window
            listContainer.scrollTop = listContainer.scrollHeight - listContainer.clientHeight + extraPadding;
          }
        }, 10);
      }
    };

    // Use requestAnimationFrame to ensure DOM is fully updated
    requestAnimationFrame(() => {
      performScroll();
    });
  };

  if (messages.length > 0) {
    // Immediate scroll attempt
    forceScrollToAbsoluteBottom();
  }
}, [messages]);







	// Update getMessages to handle both regular conversations and federated rooms
	const getMessages = async () => {
		setLoadingMessages(true);
		setMessages([]);
		try {
			if (selectedConversation.mock) {
				setLoadingMessages(false);
				return;
			}

			// Handle federated rooms
			if (selectedConversation.isFederated) {
				// For federated rooms, try to fetch existing messages from the cross-platform room
				try {
					const res = await fetchWithSession(`/api/cross-platform/rooms/${selectedConversation._id}/messages`);
					if (res.ok) {
						const data = await res.json();
						if (data.success && data.messages) {
							// Transform federated messages to match our message format
							const federatedMessages = data.messages.map(msg => ({
								_id: msg.id || msg._id || Date.now().toString(),
								text: msg.text || msg.content,
								sender: msg.sender?._id || msg.from?.userId || 'unknown',
								senderUsername: msg.sender?.username || msg.from?.displayName || 'Unknown User',
								senderPlatform: msg.sender?.platform || msg.from?.platform || 'unknown',
								createdAt: msg.timestamp || msg.sentAt || msg.createdAt || new Date().toISOString(),
								isFederated: true,
								platform: msg.platform || msg.sender?.platform || msg.from?.platform || 'unknown'
							}));
							setMessages(federatedMessages);
						}
					}
				} catch (error) {
					console.log('No existing messages found for federated room:', error);
				}
				setLoadingMessages(false);
				return;
			}

			// Handle regular conversations
			if (!selectedConversation.userId) {
				setLoadingMessages(false);
				return;
			}

			// Add a small delay for smoother transition between conversations
			await new Promise(resolve => setTimeout(resolve, 300));
			const res = await fetchWithSession(`/api/messages/${selectedConversation.userId}`);
			if (res.ok) {
				const data = await res.json();
				// Add animation class to all loaded messages
				const animatedMessages = data.map((msg, index) => ({
					...msg,
					isNew: true,
					// Stagger the animations
					animationDelay: `${index * 50}ms`
				}));
				setMessages(animatedMessages);
				// Remove animation classes after they've played
				setTimeout(() => {
					setMessages(prev => prev.map(msg => ({ ...msg, isNew: false })));
				}, 1500); // Give enough time for all animations to complete
			} else {
				const errorData = await res.json().catch(() => ({ error: 'Failed to fetch messages' }));
				showToast("Error", errorData.error || 'Failed to fetch messages', "error");
			}
		} catch (error) {
			showToast("Error", error.message, "error");
		} finally {
			setLoadingMessages(false);
		}
	};

	return (
		<Flex
			direction="column"
			flex={1}
			width="100%"
			height={{ base: "100dvh", md: "100%" }}
			maxW={{ base: "100vw", md: "100%" }} /* Removed width limitation to allow full width */
			minH="0"
			bg="#101010"
			borderRadius={{ base: "none", md: "xl" }}
			boxShadow={{ base: "none", md: "0 4px 24px rgba(0,0,0,0.25)" }}
			border={{ base: "none", md: "1px solid rgba(255,255,255,0.05)" }}
			p={0}
			m={0}
			style={{
				overflow: "hidden",
				position: "relative",
				flex: 1,
				display: "flex",
				flexDirection: "column"
			}}
		>
			{/* Message header - Minimalist style */}
			<Flex
				w={"full"}
				h={16}
				alignItems={"center"}
				justifyContent="space-between"
				px={5}
				py={3}
				borderBottom="1px solid"
				borderColor="rgba(255, 255, 255, 0.05)"
				bg="#1E1E1E"
				backdropFilter="blur(5px)"
				boxShadow="0 1px 3px rgba(0, 0, 0, 0.1)"
			>
				<Flex alignItems="center" gap={4}>
					{/* Small, simple back button always visible, no box/border, always returns to messages view */}
					<button
						onClick={handleBackClick}
						style={{
							background: 'none',
							border: 'none',
							color: '#1de9b6',
							fontSize: '1.5rem',
							cursor: 'pointer',
							marginRight: '0.5rem',
							fontWeight: 'bold',
							outline: 'none',
							padding: 0,
							zIndex: 1000
						}}
						aria-label="Back"
					>
						&larr;
					</button>

					{selectedConversation.isFederated ? (
						// Federated room header
						<>
							<Box
								w="48px"
								h="48px"
								borderRadius="full"
								bg="rgba(0, 204, 133, 0.1)"
								display="flex"
								alignItems="center"
								justifyContent="center"
								border="2px solid rgba(0, 204, 133, 0.2)"
								boxShadow="0 0 10px rgba(0, 204, 133, 0.1)"
							>
								<Text fontSize="lg">🌐</Text>
							</Box>
							<Flex direction="column">
								<Text fontWeight="bold" color="white" fontSize="md">
									{selectedConversation.name || 'Federated Room'}
								</Text>
								<Flex alignItems="center" gap={2} mt={1}>
									<Box
										w="8px"
										h="8px"
										borderRadius="full"
										bg="#00CC85"
										boxShadow="0 0 5px rgba(0, 204, 133, 0.5)"
									/>
									<Text fontSize="xs" color="#00CC85" fontWeight="medium">
										Cross-Platform Room
									</Text>
									{selectedConversation.platforms && (
										<Text fontSize="xs" color="gray.400">
											• {selectedConversation.platforms.length} platforms
										</Text>
									)}
								</Flex>
							</Flex>
						</>
					) : (
						// Regular conversation header
						<>
							<Avatar
								src={selectedConversation.userProfilePic}
								size={"md"}
								borderRadius="full"
								border="2px solid rgba(0, 204, 133, 0.2)"
								boxShadow="0 0 10px rgba(0, 204, 133, 0.1)"
							/>
							<Flex direction="column">
								<Text fontWeight="bold" color="white" fontSize="md">
									{selectedConversation.username}
								</Text>
								{/* User online status */}
								<Flex alignItems="center" gap={2} mt={1}>
									<Box
										w="8px"
										h="8px"
										borderRadius="full"
										bg={onlineUsers.includes(selectedConversation.userId) ? "#00CC85" : "gray.500"}
										boxShadow={onlineUsers.includes(selectedConversation.userId) ? "0 0 5px rgba(0, 204, 133, 0.5)" : "none"}
									/>
									<Text fontSize="xs" color={onlineUsers.includes(selectedConversation.userId) ? "#00CC85" : "gray.400"} fontWeight={onlineUsers.includes(selectedConversation.userId) ? "medium" : "normal"}>
										{onlineUsers.includes(selectedConversation.userId)
											? "Online"
											: userLastSeen[selectedConversation.userId]
												? `Last seen ${formatDistanceToNow(new Date(userLastSeen[selectedConversation.userId]), { addSuffix: true })}`
												: "Offline"}
									</Text>
								</Flex>
							</Flex>
						</>
					)}
				</Flex>

				{/* Room action buttons for federated rooms */}
				{selectedConversation.isFederated && (
					<Box display="flex" gap={2}>
						<IconButton
							icon={<FaShare />}
							size="sm"
							variant="ghost"
							color="gray.400"
							_hover={{
								bg: "rgba(0, 204, 133, 0.1)",
								color: "#00CC85"
							}}
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								console.log('Share Room clicked', { roomId: selectedConversation._id, name: selectedConversation.name });
								if (onShareRoom) {
									onShareRoom({ roomId: selectedConversation._id, name: selectedConversation.name }, e);
								}
							}}
							aria-label="Share Room ID"
							title="Share Room ID"
						/>
						<IconButton
							icon={<FaTrash />}
							size="sm"
							variant="ghost"
							color="gray.400"
							_hover={{
								bg: "rgba(255, 0, 0, 0.1)",
								color: "#ff4444"
							}}
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								console.log('Delete Room clicked', { roomId: selectedConversation._id, name: selectedConversation.name });
								if (onDeleteRoom) {
									onDeleteRoom({ roomId: selectedConversation._id, name: selectedConversation.name }, e);
								}
							}}
							aria-label="Delete Room"
							title="Delete Room"
						/>
					</Box>
				)}
			</Flex>

			{/* Message list area */}
			<Flex
				flexDirection="column"
				flex={1}
				width="100%"
				height="100%"
				px={{ base: 2, sm: 3, md: 4, lg: 5 }}
				py={{ base: 2, md: 5 }}
				gap={2}
				position="relative"
				overflowY="auto"
				style={{
					minHeight: 0
				}}
				id="messageListContainer"
				className="message-container"
				ref={containerRef}
				data-testid="message-container"
			>
				{loadingMessages ? (
					loadingSkeletons
				) : (
					<>
						{messages.length === 0 && emptyMessageState}
						{messages.length > 0 && (
							<>
								<List
									height={containerHeight}
									itemCount={messages.length}
									itemSize={itemSize}
									width={"100%"}
									style={{
										width: "100%",
										paddingBottom: "30px" // Add bottom padding for complete message visibility
									}}
									itemData={{
										messages,
										currentUser,
										handleDeleteMessage,
										shouldDisplayTimestamp,
										formatMessageTime
									}}
									overscanCount={5}
									ref={listRef}
								>
									{MessageRow}
								</List>
							</>
						)}
					</>
				)}




			</Flex>

			{/* Message input - fixed at bottom with enhanced design */}
			<Box
				mt="auto"
				width="100%"
				bg="#1E1E1E"
				borderTop="1px solid"
				borderColor="rgba(255, 255, 255, 0.05)"
				pt={3}
				px={{ base: 2, sm: 3, md: 4, lg: 5 }} /* Match message list padding for compact layout */
				pb={{
					base: "90px", // Extra space for bottom navigation on mobile
					sm: "90px",   // Keep extra space for small tablets
					md: 5         // Normal padding for larger screens
				}}
				backdropFilter="blur(5px)"
				boxShadow="0 -2px 10px rgba(0, 0, 0, 0.1)"
				zIndex={1} /* Lower z-index than menu */
				position="relative"
			>
				<MessageInput setMessages={setMessages} />
			</Box>


		</Flex>
	);
};

export default MessageContainer;
