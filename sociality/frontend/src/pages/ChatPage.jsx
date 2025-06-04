import { SearchIcon, ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { Avatar, AvatarBadge, Box, Button, Flex, IconButton, Input, InputGroup, InputRightElement, Skeleton, SkeletonCircle, Text, Switch, Tooltip, Badge, Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton } from "@chakra-ui/react";
import MessageContainer from "../components/MessageContainer";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import useShowToast from "../hooks/useShowToast";
import { useRecoilState, useRecoilValue } from "recoil";
import {
  conversationsAtom,
  selectedConversationAtom,
  userAtom
} from "../atoms";
import { useSocket } from "../hooks/useSocket";
import { BsChatDots } from "react-icons/bs";
import { FaGlobe, FaTelegram, FaDiscord, FaShare, FaTrash, FaCopy, FaSignInAlt } from "react-icons/fa";
import { fetchWithSession } from "../utils/api";

// Global declaration for process
/* global process */

const ChatPage = () => {
  const [searchingUser, setSearchingUser] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedConversation, setSelectedConversation] = useRecoilState(selectedConversationAtom);
  const [conversations, setConversations] = useRecoilState(conversationsAtom);
  const currentUser = useRecoilValue(userAtom);
  const showToast = useShowToast();
  const { socket, onlineUsers } = useSocket();

  // Cross-platform messaging state
  const [isCrossPlatformMode, setIsCrossPlatformMode] = useState(false);
  const [federatedRooms, setFederatedRooms] = useState([]);
  const [loadingFederatedRooms, setLoadingFederatedRooms] = useState(false);
  const [, setTelegramBinding] = useState(null); // telegramBinding not currently used in UI
  const [platformStatus, setPlatformStatus] = useState({
    telegram: false,
    discord: false,
    federation: false
  });
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);

  // Room menu and actions state
  const [showShareRoomModal, setShowShareRoomModal] = useState(false);
  const [showDeleteRoomModal, setShowDeleteRoomModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [deletingRoom, setDeletingRoom] = useState(false);



  // Clipboard for sharing room ID
  const [hasCopied, setHasCopied] = useState(false);

  // Scroll navigation state
  const conversationsScrollRef = useRef(null);
  const roomsScrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [showRoomsLeftArrow, setShowRoomsLeftArrow] = useState(false);
  const [showRoomsRightArrow, setShowRoomsRightArrow] = useState(false);

  // Remove unused handleGoBack function

  // Check platform status
  const checkPlatformStatus = useCallback(async () => {
    try {
      const checks = await Promise.allSettled([
        fetch('http://localhost:7300/health').then(res => res.json()),
        fetch('http://localhost:7301/health').then(res => res.json()),
        fetch('http://localhost:7302/health').then(res => res.json())
      ]);

      setPlatformStatus({
        federation: checks[0].status === 'fulfilled' && checks[0].value.status === 'ok',
        telegram: checks[1].status === 'fulfilled' && checks[1].value.status === 'ok',
        discord: checks[2].status === 'fulfilled' && checks[2].value.status === 'ok'
      });
    } catch (error) {
      console.warn('Error checking platform status:', error);
    }
  }, []);

  // Fetch federated rooms
  const fetchFederatedRooms = useCallback(async () => {
    if (!isCrossPlatformMode) return;

    setLoadingFederatedRooms(true);
    try {
      const res = await fetchWithSession('/api/cross-platform/rooms');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setFederatedRooms(data.rooms);
        } else {
          showToast("Error", data.error || "Failed to fetch federated rooms", "error");
        }
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch federated rooms' }));
        showToast("Error", errorData.error || "Failed to fetch federated rooms", "error");
      }
    } catch (error) {
      showToast("Error", "Failed to connect to federation service", "error");
    } finally {
      setLoadingFederatedRooms(false);
    }
  }, [isCrossPlatformMode, showToast]);

  // Fetch Telegram binding for current room
  const fetchTelegramBinding = useCallback(async (roomId) => {
    if (!roomId || !isCrossPlatformMode) {
      setTelegramBinding(null);
      return;
    }

    try {
      const res = await fetchWithSession(`/api/cross-platform/rooms/${roomId}/telegram`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTelegramBinding(data.bound ? data.binding : null);
        }
      } else {
        console.error('Failed to fetch Telegram binding');
        setTelegramBinding(null);
      }
    } catch (error) {
      console.error('Failed to fetch Telegram binding:', error);
      setTelegramBinding(null);
    }
  }, [isCrossPlatformMode]);

  // Create a new cross-platform room
  const handleCreateRoom = useCallback(async () => {
    if (!newRoomName.trim()) {
      showToast("Error", "Please enter a room name", "error");
      return;
    }

    console.log('Creating room with user:', currentUser);
    console.log('User authenticated:', !!currentUser);

    setCreatingRoom(true);
    try {
      const res = await fetchWithSession('/api/cross-platform/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newRoomName.trim(),
          allowedPlatforms: ['sociality', 'telegram', 'discord']
        }),
      });

      const data = await res.json();
      console.log('Room creation response:', data);

      if (data.success) {
        showToast("Success", `Room "${newRoomName}" created successfully! Room ID: ${data.room.roomId}`, "success");
        setNewRoomName("");
        setShowCreateRoomModal(false);
        // Refresh the rooms list
        await fetchFederatedRooms();
        // Auto-select the new room
        setSelectedConversation({
          _id: data.room.roomId,
          name: data.room.name,
          isFederated: true,
          platforms: []
        });
      } else {
        console.error('Room creation failed:', data);
        if (data.error === 'Authentication required' || res.status === 401) {
          showToast("Error", "Please log in to create rooms", "error");
        } else {
          showToast("Error", data.error || "Failed to create room", "error");
        }
      }
    } catch (error) {
      console.error('Room creation error:', error);
      showToast("Error", "Failed to create room", "error");
    } finally {
      setCreatingRoom(false);
    }
  }, [newRoomName, showToast, fetchFederatedRooms, setSelectedConversation, currentUser]);

  // Join a cross-platform room by ID
  const handleJoinRoom = useCallback(async () => {
    if (!joinRoomId.trim()) {
      showToast("Error", "Please enter a room ID", "error");
      return;
    }

    setJoiningRoom(true);
    try {
      const res = await fetchWithSession(`/api/cross-platform/rooms/${joinRoomId.trim()}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      console.log('Room join response:', data);

      if (data.success) {
        showToast("Success", `Successfully joined room "${data.room.name}"!`, "success");
        setJoinRoomId("");
        setShowJoinRoomModal(false);
        // Refresh the rooms list
        await fetchFederatedRooms();
        // Auto-select the joined room
        setSelectedConversation({
          _id: data.room.roomId,
          name: data.room.name,
          isFederated: true,
          platforms: []
        });
      } else {
        console.error('Room join failed:', data);
        if (data.error === 'Authentication required' || res.status === 401) {
          showToast("Error", "Please log in to join rooms", "error");
        } else {
          showToast("Error", data.error || "Failed to join room", "error");
        }
      }
    } catch (error) {
      console.error('Error joining room:', error);
      showToast("Error", "Failed to join room", "error");
    } finally {
      setJoiningRoom(false);
    }
  }, [joinRoomId, showToast, fetchFederatedRooms, setSelectedConversation]);

  // Toggle cross-platform mode
  const handleToggleCrossPlatform = useCallback(async () => {
    if (!isCrossPlatformMode) {
      // Switching to cross-platform mode
      await checkPlatformStatus();
      setIsCrossPlatformMode(true);
      // Always clear selected conversation when switching to cross-platform mode
      // This ensures only federated rooms can be selected in cross-platform mode
      setSelectedConversation({});
    } else {
      // Switching back to single platform mode
      setIsCrossPlatformMode(false);
      setFederatedRooms([]);
      // Always clear selected conversation when switching back to single platform mode
      // This ensures only regular conversations can be selected in single platform mode
      setSelectedConversation({});
    }
  }, [isCrossPlatformMode, checkPlatformStatus, setSelectedConversation]);

  // Handle room menu actions
  const handleShareRoom = useCallback((room, event) => {
    console.log('handleShareRoom called with:', room, event);
    event.stopPropagation(); // Prevent room selection
    setSelectedRoom(room);
    setShowShareRoomModal(true);
  }, []);

  const handleDeleteRoom = useCallback((room, event) => {
    console.log('handleDeleteRoom called with:', room, event);
    event.stopPropagation(); // Prevent room selection
    setSelectedRoom(room);
    setShowDeleteRoomModal(true);
  }, []);

  const handleConfirmDeleteRoom = useCallback(async () => {
    if (!selectedRoom) return;

    console.log('Deleting room:', selectedRoom);
    setDeletingRoom(true);
    try {
      const res = await fetchWithSession(`/api/cross-platform/rooms/${selectedRoom.roomId}`, {
        method: 'DELETE',
      });

      console.log('Delete response status:', res.status);

      if (res.ok) {
        const data = await res.json();
        console.log('Delete response data:', data);

        if (data.success) {
          showToast("Success", `Room "${selectedRoom.name}" deleted successfully!`, "success");

          // Immediately remove the room from the local state for instant UI update
          setFederatedRooms(prevRooms => {
            const updatedRooms = prevRooms.filter(room => room.roomId !== selectedRoom.roomId);
            console.log('Updated rooms after deletion:', updatedRooms);
            return updatedRooms;
          });

          // Clear selected conversation if it was the deleted room
          if (selectedConversation._id === selectedRoom.roomId) {
            console.log('Clearing selected conversation as it was the deleted room');
            setSelectedConversation({});
          }

          // Also refresh the rooms list from server to ensure consistency
          const refreshTimeoutId = setTimeout(() => {
            fetchFederatedRooms();
          }, 500);

          // Cleanup timeout if component unmounts
          return () => clearTimeout(refreshTimeoutId);

        } else {
          console.error('Delete failed:', data);
          showToast("Error", data.error || "Failed to delete room", "error");
        }
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Failed to delete room' }));
        console.error('Delete request failed:', errorData);
        showToast("Error", errorData.error || "Failed to delete room", "error");
      }
    } catch (error) {
      console.error('Delete room error:', error);
      showToast("Error", "Failed to delete room", "error");
    } finally {
      setDeletingRoom(false);
      setShowDeleteRoomModal(false);
      setSelectedRoom(null);
    }
  }, [selectedRoom, showToast, fetchFederatedRooms, selectedConversation, setSelectedConversation, setFederatedRooms]);

  const handleCopyRoomId = useCallback(async () => {
    if (!selectedRoom?.roomId) {
      showToast("Error", "No room ID to copy", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedRoom.roomId);
      setHasCopied(true);
      showToast("Success", "Room ID copied to clipboard!", "success");

      // Reset the copied state after 2 seconds with cleanup
      const timeoutId = setTimeout(() => {
        setHasCopied(false);
      }, 2000);

      // Store timeout ID for potential cleanup
      return () => clearTimeout(timeoutId);
    } catch (error) {
      console.error('Failed to copy room ID:', error);
      showToast("Error", "Failed to copy room ID", "error");
    }
  }, [selectedRoom?.roomId, showToast]);

  // Scroll navigation handlers
  const checkScrollArrows = useCallback((scrollRef, setShowLeft, setShowRight) => {
    if (!scrollRef.current) {
      console.log('No scroll ref available');
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const hasOverflow = scrollWidth > clientWidth;
    const canScrollLeft = scrollLeft > 0;
    const canScrollRight = scrollLeft < scrollWidth - clientWidth - 5; // More lenient threshold

    console.log('Scroll check:', {
      scrollLeft,
      scrollWidth,
      clientWidth,
      hasOverflow,
      canScrollLeft,
      canScrollRight,
      threshold: scrollWidth - clientWidth - 5
    });

    setShowLeft(canScrollLeft);
    setShowRight(hasOverflow); // Show right arrow if there's any overflow
  }, []);

  const scrollLeft = useCallback((scrollRef) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback((scrollRef) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
  }, []);

  // Handlers for conversations scroll
  const handleConversationsScroll = useCallback(() => {
    checkScrollArrows(conversationsScrollRef, setShowLeftArrow, setShowRightArrow);
  }, [checkScrollArrows]);

  const handleConversationsScrollLeft = useCallback(() => {
    scrollLeft(conversationsScrollRef);
  }, [scrollLeft]);

  const handleConversationsScrollRight = useCallback(() => {
    scrollRight(conversationsScrollRef);
  }, [scrollRight]);

  // Handlers for rooms scroll
  const handleRoomsScroll = useCallback(() => {
    checkScrollArrows(roomsScrollRef, setShowRoomsLeftArrow, setShowRoomsRightArrow);
  }, [checkScrollArrows]);

  const handleRoomsScrollLeft = useCallback(() => {
    scrollLeft(roomsScrollRef);
  }, [scrollLeft]);

  const handleRoomsScrollRight = useCallback(() => {
    scrollRight(roomsScrollRef);
  }, [scrollRight]);

  // Memoized fetchConversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetchWithSession("/api/messages/conversations");
      if (res.ok) {
        const data = await res.json();

        if (process.env.NODE_ENV === 'development') {
          console.log("Fetched conversations:", data);
        }

        // Filter out any invalid conversations before setting state
        const validConversations = data.filter(conv => {
          // Make sure the conversation has valid participants
          if (!conv.participants || conv.participants.length === 0) {
            console.warn("Filtering out conversation with no participants:", conv);
            return false;
          }

          // Make sure each participant has required fields
          const hasValidParticipants = conv.participants.every(p =>
            p && p._id && p.username && typeof p.username === 'string'
          );

          if (!hasValidParticipants) {
            console.warn("Filtering out conversation with invalid participants:", conv);
            return false;
          }

          return true;
        });

        setConversations(validConversations);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch conversations' }));
        showToast("Error", errorData.error || 'Failed to fetch conversations', "error");
      }
    } catch (error) {
      showToast("Error", error.message, "error");
    } finally {
      setLoadingConversations(false);
    }
  }, [showToast, setConversations]);

  // Memoized handler for messages seen
  const handleMessagesSeen = useCallback(({ conversationId }) => {
    setConversations((prev) => {
      const idx = prev.findIndex((conv) => conv._id === conversationId);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        lastMessage: {
          ...updated[idx].lastMessage,
          seen: true,
        },
      };
      return updated;
    });
  }, [setConversations]);

  // Memoized handler for new messages
  const handleNewMessage = useCallback((message) => {
    setConversations((prev) => {
      const idx = prev.findIndex((conv) => conv._id === message.conversationId);
      if (idx === -1) {
        // Fetch updated conversations if not present
        fetchConversations();
        return prev;
      }
      const updated = [...prev];
      // Determine message type for display
      let displayText = message.text;
      if (!displayText) {
        if (message.img) displayText = "Image";
        else if (message.gif) displayText = "GIF";
        else if (message.voice) displayText = "Voice message";
        else if (message.file) displayText = `File: ${message.fileName || 'Document'}`;
        else if (message.emoji) displayText = "Emoji";
      }
      updated[idx] = {
        ...updated[idx],
        lastMessage: {
          text: displayText,
          sender: message.sender,
          seen: currentUser._id === message.sender,
        },
      };
      return updated;
    });
  }, [setConversations, fetchConversations, currentUser._id]);

  // Memoized handler for conversation updates
  const handleConversationUpdate = useCallback((conversation) => {
    setConversations((prev) => {
      const idx = prev.findIndex((conv) => conv._id === conversation._id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = conversation;
        return updated;
      }
      return [...prev, conversation];
    });
  }, [setConversations]);

  // Memoized handler for going to main messages
  const handleGoToMainMessages = useCallback(() => {
    setSelectedConversation({});
  }, [setSelectedConversation]);

  // Memoized handler for searching conversations/rooms
  const handleConversationSearch = useCallback(async (e) => {
    e.preventDefault();

    if (isCrossPlatformMode) {
      // In cross-platform mode, search for rooms
      if (!searchText.trim()) {
        showToast("Error", "Please enter a room name or ID to search", "error");
        return;
      }

      // Filter existing rooms by search text
      const filteredRooms = federatedRooms.filter(room =>
        room.name.toLowerCase().includes(searchText.toLowerCase()) ||
        room.roomId.toLowerCase().includes(searchText.toLowerCase())
      );

      if (filteredRooms.length > 0) {
        // Select the first matching room
        setSelectedConversation({
          _id: filteredRooms[0].roomId,
          name: filteredRooms[0].name,
          isFederated: true,
          platforms: filteredRooms[0].peers || []
        });
        showToast("Success", `Found room: ${filteredRooms[0].name}`, "success");
      } else {
        showToast("Info", "No rooms found matching your search", "info");
      }
      return;
    }

    // Regular user search for single-platform mode
    setSearchingUser(true);
    try {
      const res = await fetch(`/api/users/profile/${searchText}`);
      const searchedUser = await res.json();
      if (searchedUser.error) {
        showToast("Error", searchedUser.error, "error");
        return;
      }
      const messagingYourself = searchedUser._id === currentUser._id;
      if (messagingYourself) {
        showToast("Error", "You cannot message yourself", "error");
        return;
      }
      const conversationAlreadyExists = conversations.find(
        (conv) => conv.participants.some((p) => p._id === searchedUser._id)
      );
      if (conversationAlreadyExists) {
        setSelectedConversation({
          _id: conversationAlreadyExists._id,
          userId: searchedUser._id,
          username: searchedUser.username,
          userProfilePic: searchedUser.profilePic,
        });
        return;
      }
      // Create a mock conversation but make it directly selectable
      // without adding it to the filtered conversations list
      const mockConversation = {
        mock: true,
        // No lastMessage with content so it won't show in the filtered list
        lastMessage: {
          text: "",
          sender: "",
        },
        _id: Date.now(),
        participants: [
          {
            _id: searchedUser._id,
            username: searchedUser.username,
            profilePic: searchedUser.profilePic,
          },
        ],
      };

      // Add the mock conversation to the conversations list
      setConversations((prevConvs) => [...prevConvs, mockConversation]);

      // Directly select this conversation so the user can start messaging
      setSelectedConversation({
        _id: mockConversation._id,
        userId: searchedUser._id,
        username: searchedUser.username,
        userProfilePic: searchedUser.profilePic,
        mock: true,
      });
    } catch (error) {
      showToast("Error", error.message, "error");
    } finally {
      setSearchingUser(false);
    }
  }, [searchText, showToast, currentUser._id, conversations, setSelectedConversation, setConversations, isCrossPlatformMode, federatedRooms]);

  // Memoize filtered conversations if needed (for search, etc.)
  const filteredConversations = useMemo(() => {
    // First filter out conversations that don't have any messages or valid participants
    const conversationsWithMessages = conversations.filter(conv => {
      // Make sure the conversation has valid participants
      if (!conv.participants || conv.participants.length === 0) {
        return false;
      }

      // Make sure each participant has required fields
      const hasValidParticipants = conv.participants.every(p =>
        p && p._id && p.username && typeof p.username === 'string'
      );

      if (!hasValidParticipants) {
        return false;
      }

      // Skip mock conversations that don't have real messages
      if (conv.mock && (!conv.lastMessage || !conv.lastMessage.text || conv.lastMessage.text.trim() === '')) {
        return false;
      }

      // Check if the conversation has a lastMessage with content
      // or if it's a media message (img, gif, voice, file, emoji)
      return conv.lastMessage && (
        (conv.lastMessage.text && conv.lastMessage.text.trim() !== '') ||
        conv.lastMessage.img ||
        conv.lastMessage.gif ||
        conv.lastMessage.voice ||
        conv.lastMessage.file ||
        conv.lastMessage.emoji
      );
    });

    // Then apply search filter if needed
    if (!searchText) return conversationsWithMessages;
    return conversationsWithMessages.filter(conv =>
      conv.participants.some(p =>
        p.username.toLowerCase().includes(searchText.toLowerCase())
      )
    );
  }, [conversations, searchText]);

  // Auto-select the first conversation with messages if none is selected
  useEffect(() => {
    if (!selectedConversation || !selectedConversation._id) {
      if (filteredConversations && filteredConversations.length > 0) {
        setSelectedConversation({
          _id: filteredConversations[0]._id,
          userId: filteredConversations[0]?.participants?.[0]?._id,
          userProfilePic: filteredConversations[0]?.participants?.[0]?.profilePic,
          username: filteredConversations[0]?.participants?.[0]?.username,
          mock: filteredConversations[0].mock,
        });
      }
    }
  }, [filteredConversations, selectedConversation, setSelectedConversation]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;
    socket.on("messagesSeen", handleMessagesSeen);
    socket.on("newMessage", handleNewMessage);
    socket.on("conversationUpdate", handleConversationUpdate);
    return () => {
      socket.off("messagesSeen", handleMessagesSeen);
      socket.off("newMessage", handleNewMessage);
      socket.off("conversationUpdate", handleConversationUpdate);
    };
  }, [socket, handleMessagesSeen, handleNewMessage, handleConversationUpdate]);

  // Fetch conversations when component mounts
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Fetch federated rooms when cross-platform mode is enabled
  useEffect(() => {
    if (isCrossPlatformMode) {
      fetchFederatedRooms();
    }
  }, [isCrossPlatformMode, fetchFederatedRooms]);

  // Check platform status on mount
  useEffect(() => {
    checkPlatformStatus();
  }, [checkPlatformStatus]);

  // Effect to fetch Telegram binding when selected conversation changes
  useEffect(() => {
    if (selectedConversation?.isFederated && selectedConversation._id) {
      fetchTelegramBinding(selectedConversation._id);
    } else {
      setTelegramBinding(null);
    }
  }, [selectedConversation, fetchTelegramBinding]);

  // Listen for custom event from MessageContainer to go to main message view
  useEffect(() => {
    window.addEventListener('goToMainMessages', handleGoToMainMessages);
    return () => {
      window.removeEventListener('goToMainMessages', handleGoToMainMessages);
    };
  }, [handleGoToMainMessages]);

  // DEBUG: Log conversation state in dev only
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log("conversations:", conversations);
      console.log("filteredConversations:", filteredConversations);
      console.log("loadingConversations:", loadingConversations);
      console.log("selectedConversation:", selectedConversation);

      // Log any potentially problematic conversations
      const invalidConversations = conversations.filter(conv => {
        if (!conv.participants || conv.participants.length === 0) {
          return true;
        }

        const hasInvalidParticipants = conv.participants.some(p =>
          !p || !p._id || !p.username || typeof p.username !== 'string'
        );

        if (hasInvalidParticipants) {
          return true;
        }

        return false;
      });

      if (invalidConversations.length > 0) {
        console.warn("Found invalid conversations:", invalidConversations);
      }
    }
  }, [conversations, filteredConversations, loadingConversations, selectedConversation]);

  // Check scroll arrows when conversations change
  useEffect(() => {
    if (!loadingConversations && filteredConversations.length > 0) {
      const timeoutId = setTimeout(() => {
        checkScrollArrows(conversationsScrollRef, setShowLeftArrow, setShowRightArrow);
        console.log('Checking conversation arrows:', {
          conversations: filteredConversations.length,
          showLeft: showLeftArrow,
          showRight: showRightArrow,
          scrollRef: conversationsScrollRef.current
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [filteredConversations, loadingConversations, checkScrollArrows, showLeftArrow, showRightArrow]);

  // Check scroll arrows when federated rooms change
  useEffect(() => {
    if (!loadingFederatedRooms && federatedRooms.length > 0) {
      const timeoutId = setTimeout(() => {
        checkScrollArrows(roomsScrollRef, setShowRoomsLeftArrow, setShowRoomsRightArrow);
        console.log('Checking room arrows:', {
          rooms: federatedRooms.length,
          showLeft: showRoomsLeftArrow,
          showRight: showRoomsRightArrow,
          scrollRef: roomsScrollRef.current
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [federatedRooms, loadingFederatedRooms, checkScrollArrows, showRoomsLeftArrow, showRoomsRightArrow]);

  return (
    <Flex
      w="100vw"
      h="100vh"
      alignItems="center"
      justifyContent="center"
      bg="#101010"
      position="fixed"
      top="0"
      left="0"
      right="0"
      bottom="0"
      p={0}
      m={0}
    >
      <Box
        w={{ base: "100%", md: "650px", lg: "750px" }} /* Further reduced width for better navigation clearance */
        maxW={{ base: "100%", md: "650px", lg: "750px" }}
        minW={{ base: '100%', md: '650px', lg: '750px' }}
        h={{ base: "100%", md: "90vh" }} /* Increased height */
        maxH={{ base: "100%", md: "850px" }}
        bg="#101010"
        borderRadius={{ base: "none", md: "xl" }}
        boxShadow={{ base: "none", md: "0 8px 32px 0 rgba(0, 0, 0, 0.3)" }}
        border={{ base: "none", md: "1px solid rgba(255,255,255,0.05)" }}
        color="white"
        p={0}
        m={0}
        mx="auto"  /* Center horizontally */
        overflow="hidden"
        transition="all 0.3s ease-in-out"
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"  /* Perfect centering technique for both horizontal and vertical */
      >
        <Flex
          gap={0}
          flexDirection={{ base: "column", md: "column" }} /* Changed to column for both mobile and desktop */
          w="100%"
          maxW="100%"
          mx={"auto"}
          h="full"
          bg="#101010"
          borderRadius={{ base: "none", md: "xl" }}
          boxShadow="none"
          overflow="hidden"
          justifyContent="flex-start"  /* Align items from the top */
          p={0}
          m={0}
        >
          {/* Conversations list - enhanced design */}
          <Flex
            flex={{ base: "0 0 auto", md: "0 0 auto" }} /* Auto height */
            gap={2}
            flexDirection={"column"}
            w="100%" /* Full width */
            maxW="100%" /* Full width */
            display="flex"
            borderBottom="1px solid rgba(255, 255, 255, 0.05)" /* Border at bottom */
            overflowY="hidden" /* No scrolling */
            bg="#1E1E1E"
            borderRadius={{ base: "none", md: "xl xl 0 0" }} /* Rounded corners at top */
            boxShadow="0 4px 12px rgba(0, 0, 0, 0.2)"
            h="auto" /* Auto height */
            py={{ base: 1, md: 2 }}
            px={{ base: 1, md: 2 }}
            css={{
              '&::-webkit-scrollbar': {
                width: '4px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(0, 204, 133, 0.2)',
                borderRadius: '10px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: 'rgba(0, 204, 133, 0.3)',
              }
            }}
          >
            {/* Redesigned header with cross-platform toggle */}
            <Flex
              bg="#1E1E1E"
              color="white"
              p={3}
              alignItems="center"
              justifyContent="space-between"
              mb={2}
              borderBottom="1px solid"
              borderColor="rgba(255, 255, 255, 0.05)"
              borderRadius="lg"
              boxShadow="0 2px 8px rgba(0, 0, 0, 0.2)"
              w="100%"
              flexDirection="column"
              gap={3}
            >
              {/* Top row - Title and Cross-Platform Toggle */}
              <Flex alignItems="center" justifyContent="space-between" w="100%">
                {/* Left side - Title */}
                <Flex alignItems="center" gap={2}>
                  <Box
                    bg="rgba(0, 204, 133, 0.1)"
                    p={2}
                    borderRadius="lg"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    boxShadow="0 0 10px rgba(0, 204, 133, 0.1)"
                  >
                    {isCrossPlatformMode ? <FaGlobe size={20} color="#00CC85" /> : <BsChatDots size={20} color="#00CC85" />}
                  </Box>
                  <Flex flexDirection="column" alignItems="flex-start">
                    <Text fontWeight="bold" fontSize="lg" letterSpacing="wide">
                      {isCrossPlatformMode ? "Cross-Platform" : "Messages"}
                    </Text>
                    {isCrossPlatformMode && (
                      <Flex alignItems="center" gap={1} mt={1}>
                        <Badge
                          size="xs"
                          colorScheme={platformStatus.telegram ? "green" : "red"}
                          variant="solid"
                        >
                          <FaTelegram size={8} />
                        </Badge>
                        <Badge
                          size="xs"
                          colorScheme={platformStatus.discord ? "green" : "red"}
                          variant="solid"
                        >
                          <FaDiscord size={8} />
                        </Badge>
                        <Badge
                          size="xs"
                          colorScheme={platformStatus.federation ? "green" : "red"}
                          variant="solid"
                        >
                          Fed
                        </Badge>
                      </Flex>
                    )}
                  </Flex>
                </Flex>

                {/* Right side - Cross-Platform Toggle */}
                <Tooltip
                  label={isCrossPlatformMode ? "Switch to single platform" : "Enable cross-platform messaging"}
                  placement="left"
                >
                  <Flex alignItems="center" gap={2}>
                    <Text fontSize="xs" color="gray.400">Cross-Platform</Text>
                    <Switch
                      isChecked={isCrossPlatformMode}
                      onChange={handleToggleCrossPlatform}
                      colorScheme="green"
                      size="sm"
                    />
                  </Flex>
                </Tooltip>
              </Flex>

              {/* Bottom row - Search */}
              <form onSubmit={handleConversationSearch} style={{ margin: 0, width: '100%' }}>
                <InputGroup size="sm">
                  <Input
                    placeholder={isCrossPlatformMode ? 'Search rooms...' : 'Search user...'}
                    onChange={(e) => setSearchText(e.target.value)}
                    bg="rgba(30, 30, 30, 0.4)"
                    borderColor="rgba(255, 255, 255, 0.05)"
                    _focus={{
                      borderColor: "rgba(0, 204, 133, 0.3)",
                      boxShadow: "0 0 0 1px rgba(0, 204, 133, 0.2)"
                    }}
                    _hover={{
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      bg: "rgba(30, 30, 30, 0.5)"
                    }}
                    borderRadius="full"
                    color="white"
                    fontSize="sm"
                    h="32px"
                  />
                  <InputRightElement h="32px" w="32px">
                    <IconButton
                      aria-label="Search"
                      icon={<SearchIcon />}
                      size="xs"
                      isLoading={searchingUser}
                      type="submit"
                      bg="rgba(0, 204, 133, 0.1)"
                      color="#00CC85"
                      _hover={{
                        bg: "rgba(0, 204, 133, 0.2)"
                      }}
                      borderRadius="full"
                      boxShadow="0 0 10px rgba(0, 204, 133, 0.1)"
                    />
                  </InputRightElement>
                </InputGroup>
              </form>
            </Flex>

            {/* Conversations */}
                {/* Recent contacts/rooms label with View All button */}
                <Flex
                  px={3}
                  py={1}
                  justifyContent="space-between"
                  alignItems="center"
                  mb={1}
                >
                  <Text fontSize="xs" color="gray.400" fontWeight="medium">
                    {isCrossPlatformMode ? "FEDERATED ROOMS" : "RECENT CONTACTS"}
                  </Text>
                  {isCrossPlatformMode && (
                    <Flex gap={2}>
                      <Button
                        size="xs"
                        variant="ghost"
                        color="#00CC85"
                        fontSize="xs"
                        _hover={{ bg: "rgba(0, 204, 133, 0.1)" }}
                        onClick={() => setShowCreateRoomModal(true)}
                      >
                        Create Room
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        color="#00A3FF"
                        fontSize="xs"
                        _hover={{ bg: "rgba(0, 163, 255, 0.1)" }}
                        onClick={() => setShowJoinRoomModal(true)}
                      >
                        Join Room
                      </Button>
                    </Flex>
                  )}
                  {!isCrossPlatformMode && filteredConversations.length > 6 && (
                    <Button
                      size="xs"
                      variant="ghost"
                      color="#00CC85"
                      fontSize="xs"
                      _hover={{ bg: "rgba(0, 204, 133, 0.1)" }}
                      onClick={() => {
                        // Open a modal or expand to show all contacts
                        showToast("Info", "View all contacts feature coming soon", "info");
                      }}
                    >
                      View All
                    </Button>
                  )}
            </Flex>

            {(loadingConversations || (isCrossPlatformMode && loadingFederatedRooms)) && (
              <Flex
                direction="row"
                wrap="wrap"
                gap={2}
                justifyContent="flex-start"
                alignItems="center"
                px={1}
              >
                {[0, 1, 2, 3, 4, 5].map((_, i) => (
                  <Box
                    key={i}
                    w={{ base: "calc(33% - 8px)", md: "calc(16.66% - 10px)" }}
                    mb={1}
                    opacity={1 - (i * 0.1)}
                  >
                    <Flex
                      direction="column"
                      align="center"
                      p={1}
                      borderRadius="md"
                    >
                      <SkeletonCircle
                        size="12"
                        startColor="#1E1E1E"
                        endColor="#151515"
                        borderRadius="full"
                        boxShadow="0 0 3px rgba(0, 204, 133, 0.1)"
                        mb={1}
                      />
                      <Skeleton h="8px" w="80%" startColor="#1E1E1E" endColor="#151515" borderRadius="full" />
                    </Flex>
                  </Box>
                ))}
              </Flex>
            )}

            {!loadingConversations && !loadingFederatedRooms && (
              isCrossPlatformMode ? (
                // Cross-platform mode empty state
                federatedRooms.length === 0 && (
                  <Flex direction="row" align="center" justify="center" p={2} wrap="wrap" gap={2}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Box
                        key={i}
                        w={{ base: "calc(33% - 8px)", md: "calc(16.66% - 10px)" }}
                        mb={1}
                      >
                        <Flex
                          direction="column"
                          align="center"
                          p={1}
                          borderRadius="md"
                          bg="rgba(30, 30, 30, 0.3)"
                          opacity={0.5}
                          cursor="pointer"
                          onClick={() => showToast("Info", "Create a federated room to start cross-platform messaging", "info")}
                          _hover={{ bg: "rgba(30, 30, 30, 0.5)" }}
                        >
                          <Box
                            p={2}
                            borderRadius="full"
                            bg="rgba(0, 204, 133, 0.05)"
                            mb={1}
                            boxShadow="0 0 5px rgba(0, 204, 133, 0.05)"
                            w="40px"
                            h="40px"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <FaGlobe size={16} color="#00CC85" />
                          </Box>
                          <Text fontSize="xs" color="gray.400">
                            {i % 2 === 0 ? "New room" : "Join room"}
                          </Text>
                        </Flex>
                      </Box>
                    ))}
                  </Flex>
                )
              ) : (
                // Regular mode empty state
                conversations.length === 0 && (
                  <Flex direction="row" align="center" justify="center" p={2} wrap="wrap" gap={2}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Box
                        key={i}
                        w={{ base: "calc(33% - 8px)", md: "calc(16.66% - 10px)" }}
                        mb={1}
                      >
                        <Flex
                          direction="column"
                          align="center"
                          p={1}
                          borderRadius="md"
                          bg="rgba(30, 30, 30, 0.3)"
                          opacity={0.5}
                          cursor="pointer"
                          onClick={() => showToast("Info", "Search for a user to start chatting", "info")}
                          _hover={{ bg: "rgba(30, 30, 30, 0.5)" }}
                        >
                          <Box
                            p={2}
                            borderRadius="full"
                            bg="rgba(0, 204, 133, 0.05)"
                            mb={1}
                            boxShadow="0 0 5px rgba(0, 204, 133, 0.05)"
                            w="40px"
                            h="40px"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <BsChatDots size={16} color="#00CC85" />
                          </Box>
                          <Text fontSize="xs" color="gray.400">
                            {i % 2 === 0 ? "New chat" : "Add user"}
                          </Text>
                        </Flex>
                      </Box>
                    ))}
                  </Flex>
                )
              )
            )}

            {!loadingConversations && !loadingFederatedRooms && (
              <Box position="relative" w="100%">
                {/* Left scroll arrow */}
                {(isCrossPlatformMode ? showRoomsLeftArrow : showLeftArrow) && (
                  <IconButton
                    aria-label="Scroll left"
                    icon={<ChevronLeftIcon />}
                    onClick={isCrossPlatformMode ? handleRoomsScrollLeft : handleConversationsScrollLeft}
                    position="absolute"
                    left="-8px"
                    top="50%"
                    transform="translateY(-50%)"
                    zIndex={2}
                    bg="rgba(30, 30, 30, 0.7)"
                    color="white"
                    borderWidth="1px"
                    borderColor="rgba(255, 255, 255, 0.1)"
                    borderRadius="full"
                    size="sm"
                    boxShadow="none"
                    _hover={{
                      bg: "rgba(40, 40, 40, 0.8)",
                      transform: "translateY(-50%) scale(1.1)",
                    }}
                    transition="all 0.2s ease"
                  />
                )}

                {/* Right scroll arrow */}
                {(isCrossPlatformMode ? showRoomsRightArrow : showRightArrow) && (
                  <IconButton
                    aria-label="Scroll right"
                    icon={<ChevronRightIcon />}
                    onClick={isCrossPlatformMode ? handleRoomsScrollRight : handleConversationsScrollRight}
                    position="absolute"
                    right="-8px"
                    top="50%"
                    transform="translateY(-50%)"
                    zIndex={2}
                    bg="rgba(30, 30, 30, 0.7)"
                    color="white"
                    borderWidth="1px"
                    borderColor="rgba(255, 255, 255, 0.1)"
                    borderRadius="full"
                    size="sm"
                    boxShadow="none"
                    _hover={{
                      bg: "rgba(40, 40, 40, 0.8)",
                      transform: "translateY(-50%) scale(1.1)",
                    }}
                    transition="all 0.2s ease"
                  />
                )}

                <Box
                  overflowX="auto"
                  overflowY="hidden"
                  maxH="120px"
                  w="100%"
                  ref={isCrossPlatformMode ? roomsScrollRef : conversationsScrollRef}
                  onScroll={isCrossPlatformMode ? handleRoomsScroll : handleConversationsScroll}
                  css={{
                    '&::-webkit-scrollbar': {
                      display: 'none',
                    },
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  }}
                >
                  <Flex
                    direction="row"
                    wrap="nowrap"
                    gap={2}
                    justifyContent="flex-start"
                    alignItems="center"
                    px={1}
                    minW="max-content"
                  >
                  {isCrossPlatformMode ? (
                    // Show all federated rooms (removed slice limitation)
                    federatedRooms.map((room) => (
                    <Box
                      key={room.roomId}
                      w="80px"
                      minW="80px"
                      flexShrink={0}
                      mb={1}
                    >
                      <Flex
                        direction="column"
                        align="center"
                        bg={selectedConversation?._id === room.roomId ? "rgba(0, 204, 133, 0.1)" : "transparent"}
                        p={1}
                        borderRadius="md"
                        cursor="pointer"
                        onClick={() => {
                          setSelectedConversation({
                            _id: room.roomId,
                            name: room.name,
                            isFederated: true,
                            platforms: room.peers || []
                          });
                        }}
                        _hover={{ bg: "rgba(0, 204, 133, 0.05)" }}
                        transition="all 0.2s"
                        position="relative"
                      >
                        <Box position="relative">
                          <Box
                            w="48px"
                            h="48px"
                            borderRadius="full"
                            bg="rgba(0, 204, 133, 0.1)"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            border="2px solid #00CC85"
                            mb={1}
                            boxShadow="0 0 10px rgba(0, 204, 133, 0.2)"
                          >
                            <FaGlobe size={20} color="#00CC85" />
                          </Box>
                          {/* Platform indicators */}
                          <Flex
                            position="absolute"
                            bottom="0"
                            right="-2px"
                            gap="1px"
                            flexDirection="column"
                          >
                            {room.peers?.includes('http://localhost:7301') && (
                              <Box
                                w="12px"
                                h="12px"
                                borderRadius="full"
                                bg="#0088cc"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                border="1px solid white"
                              >
                                <FaTelegram size={6} color="white" />
                              </Box>
                            )}
                            {room.peers?.includes('http://localhost:7302') && (
                              <Box
                                w="12px"
                                h="12px"
                                borderRadius="full"
                                bg="#5865F2"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                border="1px solid white"
                              >
                                <FaDiscord size={6} color="white" />
                              </Box>
                            )}
                          </Flex>
                        </Box>
                        <Text
                          fontSize="xs"
                          fontWeight="medium"
                          color="white"
                          noOfLines={1}
                          textAlign="center"
                          maxW="100%"
                        >
                          {room.name}
                        </Text>
                      </Flex>
                    </Box>
                  ))
                  ) : (
                    // Show all regular conversations (removed slice limitation)
                    filteredConversations.map((conversation) => (
                    <Box
                      key={conversation._id}
                      w="80px"
                      minW="80px"
                      flexShrink={0}
                      mb={1}
                    >
                      <Flex
                        direction="column"
                        align="center"
                        bg={selectedConversation?._id === conversation._id ? "rgba(0, 204, 133, 0.1)" : "transparent"}
                        p={1}
                        borderRadius="md"
                        cursor="pointer"
                        onClick={() => {
                          setSelectedConversation({
                            _id: conversation._id,
                            userId: conversation?.participants?.[0]?._id,
                            userProfilePic: conversation?.participants?.[0]?.profilePic,
                            username: conversation?.participants?.[0]?.username,
                            mock: conversation.mock,
                          });
                        }}
                        _hover={{ bg: "rgba(0, 204, 133, 0.05)" }}
                        transition="all 0.2s"
                      >
                        <Box position="relative">
                          <Avatar
                            size="md"
                            src={conversation?.participants?.[0]?.profilePic}
                            border={onlineUsers.includes(conversation?.participants?.[0]?._id) ? "2px solid #00CC85" : "2px solid #be0510"}
                            mb={1}
                          >
                            {onlineUsers.includes(conversation?.participants?.[0]?._id) ? (
                              <AvatarBadge
                                boxSize='0.8em'
                                bg='#00CC85'
                                style={{
                                  boxShadow: '0 0 8px 2px #00CC85, 0 0 2px 1px #00CC85'
                                }}
                              />
                            ) : (
                              <AvatarBadge
                                boxSize='0.8em'
                                bg='#be0510'
                                style={{
                                  boxShadow: '0 0 8px 2px #be0510, 0 0 2px 1px #be0510'
                                }}
                              />
                            )}
                          </Avatar>
                        </Box>
                        <Text
                          fontSize="xs"
                          fontWeight={conversation.lastMessage?.seen ? "normal" : "bold"}
                          color="white"
                          noOfLines={1}
                          textAlign="center"
                          maxW="100%"
                        >
                          {conversation?.participants?.[0]?.username}
                        </Text>
                      </Flex>
                    </Box>
                  ))
                  )}
                  </Flex>
                </Box>
              </Box>
            )}
          </Flex>

          {/* Message area - enhanced design */}
            <Flex
              flex="1 1 auto" /* Take remaining space */
              p={0}
              flexDir={"column"}
              alignItems={"center"}
              justifyContent={"center"}
              w="100%" /* Full width */
              bg="#101010"
              borderRadius={{ base: "none", md: "0 0 xl xl" }} /* Rounded corners at bottom */
              boxShadow="0 4px 12px rgba(0, 0, 0, 0.2)"
              overflowY="auto"
              overflowX="hidden" /* Prevent horizontal scroll */
              h={{ base: "calc(100% - 160px)", md: "calc(100% - 160px)" }} /* Fixed calculation */
              py={0}
              px={0}
              borderTop="none"
              style={{ minWidth: 0 }} /* Prevent flex item from growing beyond container */
              m={0}
            >
              {selectedConversation._id &&
               // Ensure conversation type matches current mode
               ((isCrossPlatformMode && selectedConversation.isFederated) ||
                (!isCrossPlatformMode && !selectedConversation.isFederated)) ? (
                <MessageContainer
                  onShareRoom={handleShareRoom}
                  onDeleteRoom={handleDeleteRoom}
                />
              ) : (
                <Flex
                  direction="column"
                  align="center"
                  justify="center"
                  h="full"
                  w="full"
                  color="white"
                  bg="#101010"
                  p={8}
                >
                  <Box
                    p={6}
                    borderRadius="full"
                    bg="rgba(0, 204, 133, 0.05)"
                    mb={6}
                    boxShadow="0 0 30px rgba(0, 204, 133, 0.1)"
                  >
                    {isCrossPlatformMode ? (
                      <FaGlobe size={40} color="#00CC85" />
                    ) : (
                      <BsChatDots size={40} color="#00CC85" />
                    )}
                  </Box>
                  <Text mt={2} fontSize="2xl" fontWeight="bold" color="white" mb={3}>
                    {isCrossPlatformMode ? "Cross-Platform Messaging" : "Your Messages"}
                  </Text>
                  <Box
                    maxW="400px"
                    p={5}
                    borderRadius="xl"
                    bg="rgba(30, 30, 30, 0.3)"
                    backdropFilter="blur(5px)"
                    boxShadow="0 4px 12px rgba(0, 0, 0, 0.1)"
                    border="1px solid rgba(255, 255, 255, 0.05)"
                    textAlign="center"
                  >
                    <Text color="gray.300" fontSize="md">
                      {isCrossPlatformMode
                        ? "Select a room to start cross-platform messaging or create a new room to connect with users on Telegram and Discord"
                        : "Select a conversation from the list or search for a user to start a new chat"
                      }
                    </Text>
                  </Box>
                </Flex>
              )}
            </Flex>
        </Flex>
      </Box>

      {/* Create Room Modal */}
      <Modal isOpen={showCreateRoomModal} onClose={() => setShowCreateRoomModal(false)} isCentered>
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent bg="#1E1E1E" color="white" border="1px solid rgba(255,255,255,0.1)">
          <ModalHeader>
            <Flex alignItems="center" gap={2}>
              <Box
                bg="rgba(0, 204, 133, 0.1)"
                p={2}
                borderRadius="lg"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <FaGlobe size={16} color="#00CC85" />
              </Box>
              <Text>Create Cross-Platform Room</Text>
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color="gray.400" mb={4}>
              Create a private room that allows messaging across Sociality, Telegram, and Discord platforms. Only users with the room ID can join.
            </Text>
            <Input
              placeholder="Enter room name..."
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              bg="rgba(30, 30, 30, 0.4)"
              borderColor="rgba(255, 255, 255, 0.1)"
              _focus={{
                borderColor: "rgba(0, 204, 133, 0.5)",
                boxShadow: "0 0 0 1px rgba(0, 204, 133, 0.2)"
              }}
              _hover={{
                borderColor: "rgba(255, 255, 255, 0.2)"
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !creatingRoom) {
                  handleCreateRoom();
                }
              }}
            />
            <Text fontSize="xs" color="gray.500" mt={2}>
              A unique room ID will be generated that you can share with others to invite them to your private room.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              mr={3}
              onClick={() => setShowCreateRoomModal(false)}
              color="gray.400"
              _hover={{ bg: "rgba(255, 255, 255, 0.1)" }}
            >
              Cancel
            </Button>
            <Button
              bg="#00CC85"
              color="white"
              _hover={{ bg: "#00B377" }}
              onClick={handleCreateRoom}
              isLoading={creatingRoom}
              loadingText="Creating..."
              isDisabled={!newRoomName.trim()}
            >
              Create Room
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Join Room Modal */}
      <Modal isOpen={showJoinRoomModal} onClose={() => setShowJoinRoomModal(false)} isCentered>
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent bg="#1E1E1E" color="white" border="1px solid rgba(255,255,255,0.1)">
          <ModalHeader>
            <Flex alignItems="center" gap={2}>
              <Box
                bg="rgba(0, 163, 255, 0.1)"
                p={2}
                borderRadius="lg"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <FaSignInAlt size={16} color="#00A3FF" />
              </Box>
              <Text>Join Cross-Platform Room</Text>
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color="gray.400" mb={4}>
              Enter a Room ID to join a private cross-platform room. You can get this ID from the room creator.
            </Text>
            <Input
              placeholder="Enter Room ID..."
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              bg="rgba(30, 30, 30, 0.4)"
              borderColor="rgba(255, 255, 255, 0.1)"
              _focus={{
                borderColor: "rgba(0, 163, 255, 0.5)",
                boxShadow: "0 0 0 1px rgba(0, 163, 255, 0.2)"
              }}
              _placeholder={{ color: "gray.500" }}
            />
            <Text fontSize="xs" color="gray.500" mt={2}>
              Room IDs are unique identifiers that allow you to join private rooms across platforms.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              mr={3}
              onClick={() => setShowJoinRoomModal(false)}
              color="gray.400"
              _hover={{ bg: "rgba(255, 255, 255, 0.1)" }}
            >
              Cancel
            </Button>
            <Button
              bg="#00A3FF"
              color="white"
              _hover={{ bg: "#0092E6" }}
              onClick={handleJoinRoom}
              isLoading={joiningRoom}
              loadingText="Joining..."
              isDisabled={!joinRoomId.trim()}
            >
              Join Room
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Share Room ID Modal */}
      <Modal isOpen={showShareRoomModal} onClose={() => setShowShareRoomModal(false)} isCentered>
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent bg="#1E1E1E" color="white" border="1px solid rgba(255,255,255,0.1)">
          <ModalHeader>
            <Flex alignItems="center" gap={2}>
              <Box
                bg="rgba(0, 204, 133, 0.1)"
                p={2}
                borderRadius="lg"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <FaShare size={16} color="#00CC85" />
              </Box>
              <Text>Share Room ID</Text>
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color="gray.400" mb={4}>
              Share this Room ID with users on other platforms (Telegram, Discord) so they can join this cross-platform room.
            </Text>
            <Flex gap={2} alignItems="center">
              <Input
                value={selectedRoom?.roomId || ""}
                isReadOnly
                bg="rgba(30, 30, 30, 0.4)"
                borderColor="rgba(255, 255, 255, 0.1)"
                _focus={{
                  borderColor: "rgba(0, 204, 133, 0.5)",
                  boxShadow: "0 0 0 1px rgba(0, 204, 133, 0.2)"
                }}
              />
              <Button
                leftIcon={<FaCopy />}
                onClick={handleCopyRoomId}
                bg={hasCopied ? "#00B377" : "#00CC85"}
                color="white"
                _hover={{ bg: hasCopied ? "#00B377" : "#00B377" }}
                size="sm"
                minW="100px"
              >
                {hasCopied ? "Copied!" : "Copy"}
              </Button>
            </Flex>
            <Text fontSize="xs" color="gray.500" mt={2}>
              Users on other platforms can use this Room ID to join and participate in cross-platform messaging.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              onClick={() => setShowShareRoomModal(false)}
              color="gray.400"
              _hover={{ bg: "rgba(255, 255, 255, 0.1)" }}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Room Confirmation Modal */}
      <Modal isOpen={showDeleteRoomModal} onClose={() => setShowDeleteRoomModal(false)} isCentered>
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent bg="#1E1E1E" color="white" border="1px solid rgba(255,255,255,0.1)">
          <ModalHeader>
            <Flex alignItems="center" gap={2}>
              <Box
                bg="rgba(255, 0, 0, 0.1)"
                p={2}
                borderRadius="lg"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <FaTrash size={16} color="#ff4444" />
              </Box>
              <Text>Delete Room</Text>
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color="gray.400" mb={4}>
              Are you sure you want to delete the room &quot;{selectedRoom?.name}&quot;? This action cannot be undone and will remove the room from all connected platforms.
            </Text>
            <Box
              bg="rgba(255, 0, 0, 0.1)"
              p={3}
              borderRadius="md"
              border="1px solid rgba(255, 0, 0, 0.2)"
            >
              <Text fontSize="xs" color="red.300" fontWeight="medium">
                ⚠️ Warning: This will permanently delete the room and all its messages across all platforms.
              </Text>
            </Box>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              mr={3}
              onClick={() => setShowDeleteRoomModal(false)}
              color="gray.400"
              _hover={{ bg: "rgba(255, 255, 255, 0.1)" }}
            >
              Cancel
            </Button>
            <Button
              bg="#ff4444"
              color="white"
              _hover={{ bg: "#ff3333" }}
              onClick={handleConfirmDeleteRoom}
              isLoading={deletingRoom}
              loadingText="Deleting..."
            >
              Delete Room
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Flex>
  );
};

export default ChatPage;
