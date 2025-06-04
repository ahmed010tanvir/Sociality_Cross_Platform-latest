import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Flex, Image, Skeleton, Text, Menu, MenuButton, MenuItem, MenuList, IconButton, Icon, Button, Modal, ModalOverlay, ModalContent, ModalBody, Spinner, Progress, Tooltip, AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay, Badge } from "@chakra-ui/react";
import { BsCheck2All, BsCheck2, BsThreeDotsVertical, BsFileEarmarkFill, BsClock } from "react-icons/bs";
import { FaTrash, FaMicrophone, FaPlay, FaPause, FaTelegram, FaDiscord, FaGlobe } from "react-icons/fa";
import { AddIcon, MinusIcon, CloseIcon, DownloadIcon } from "@chakra-ui/icons";
import { useRecoilValue } from "recoil";
import { selectedConversationAtom } from "../atoms";

// Pure helpers outside component
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatMessageTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getPlatformIcon = (platform) => {
  switch (platform) {
    case 'telegram':
      return <FaTelegram size={12} color="#0088cc" />;
    case 'discord':
      return <FaDiscord size={12} color="#5865F2" />;
    case 'sociality':
      return <FaGlobe size={12} color="#00CC85" />;
    default:
      return <FaGlobe size={12} color="#888" />;
  }
};

const getPlatformColor = (platform) => {
  switch (platform) {
    case 'telegram':
      return '#0088cc';
    case 'discord':
      return '#5865F2';
    case 'sociality':
      return '#00CC85';
    default:
      return '#888';
  }
};

const Message = React.memo(({ ownMessage, message, onDelete }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImage, setCurrentImage] = useState("");
  const [audioPlayer, setAudioPlayer] = useState(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  const cancelRef = useRef();
  const selectedConversation = useRecoilValue(selectedConversationAtom);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [currentMediaType, setCurrentMediaType] = useState("image");

  // Memoized status icon
  const getStatusIcon = useCallback(() => {
    if (message.isOptimistic) return <BsClock size={14} />;
    if (!message.seen) return <BsCheck2 size={14} />;
    return <BsCheck2All size={14} color="#0088ff" />;
  }, [message.isOptimistic, message.seen]);

  // Memoized delete dialog handler
  const handleDelete = useCallback((forEveryone) => {
    setDeleteForEveryone(forEveryone);
    setIsDeleteAlertOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    onDelete(message._id, deleteForEveryone);
    setIsDeleteAlertOpen(false);
  }, [onDelete, message._id, deleteForEveryone]);

  // Memoized play handler
  const togglePlay = useCallback(() => {
    if (!message.voice) return;
    if (!audioPlayer) {
      const player = new Audio(message.voice);
      player.onended = () => {
        setIsPlaying(false);
        setPlaybackProgress(0);
      };
      player.ontimeupdate = () => {
        const progress = (player.currentTime / player.duration) * 100;
        setPlaybackProgress(progress);
      };
      setAudioPlayer(player);
      player.play().catch(err => {
        console.error("Audio playback error:", err);
      });
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        audioPlayer.pause();
      } else {
        audioPlayer.play().catch(err => {
          console.error("Audio playback error:", err);
        });
      }
      setIsPlaying(!isPlaying);
    }
  }, [message.voice, audioPlayer, isPlaying]);

  // Clean up audio player
  useEffect(() => {
    return () => {
      if (audioPlayer) {
        audioPlayer.pause();
        setAudioPlayer(null);
      }
    };
  }, [audioPlayer]);

  // Memoized image click handler
  const handleImageClick = useCallback((imageUrl, mediaType = "image") => {
    setCurrentImage(imageUrl);
    setCurrentMediaType(mediaType);
    setShowImageModal(true);
    setZoomLevel(1);
    setIsImageLoading(true);
  }, []);

  // Memoized download handler
  const handleDownloadImage = useCallback((imageUrl, type = "image", fileInfo = null) => {
    const contentType = type === "file" ? "file" : "image";
    const loadingMessage = document.createElement("div");
    loadingMessage.style.position = "fixed";
    loadingMessage.style.bottom = "20px";
    loadingMessage.style.left = "50%";
    loadingMessage.style.transform = "translateX(-50%)";
    loadingMessage.style.backgroundColor = "#3182CE";
    loadingMessage.style.color = "white";
    loadingMessage.style.padding = "10px 20px";
    loadingMessage.style.borderRadius = "4px";
    loadingMessage.style.zIndex = "9999";
    loadingMessage.textContent = `Downloading ${contentType}...`;
    document.body.appendChild(loadingMessage);
    fetch(imageUrl)
      .then(response => response.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        let filename;
        if (type === "file" && fileInfo && fileInfo.fileName) {
          filename = fileInfo.fileName;
        } else {
          const extension = blob.type.split("/")[1] || (type === "file" ? "bin" : "jpg");
          filename = `${type}-${new Date().getTime()}.${extension}`;
        }
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        document.body.removeChild(loadingMessage);
        const successMessage = document.createElement("div");
        successMessage.style.position = "fixed";
        successMessage.style.bottom = "20px";
        successMessage.style.left = "50%";
        successMessage.style.transform = "translateX(-50%)";
        successMessage.style.backgroundColor = "#38A169";
        successMessage.style.color = "white";
        successMessage.style.padding = "10px 20px";
        successMessage.style.borderRadius = "4px";
        successMessage.style.zIndex = "9999";
        successMessage.textContent = `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} downloaded successfully!`;
        document.body.appendChild(successMessage);
        setTimeout(() => {
          document.body.removeChild(successMessage);
        }, 3000);
      })
      .catch(error => {
        document.body.removeChild(loadingMessage);
        const errorMessage = document.createElement("div");
        errorMessage.style.position = "fixed";
        errorMessage.style.bottom = "20px";
        errorMessage.style.left = "50%";
        errorMessage.style.transform = "translateX(-50%)";
        errorMessage.style.backgroundColor = "#E53E3E";
        errorMessage.style.color = "white";
        errorMessage.style.padding = "10px 20px";
        errorMessage.style.borderRadius = "4px";
        errorMessage.style.zIndex = "9999";
        errorMessage.textContent = `Failed to download ${contentType}. Please try again.`;
        document.body.appendChild(errorMessage);
        setTimeout(() => {
          document.body.removeChild(errorMessage);
        }, 3000);
        console.error("Download error:", error);
      });
  }, []);

  // Memoized zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  }, []);
  const handleResetZoom = useCallback(() => {
    setZoomLevel(1);
  }, []);

  // Keyboard shortcuts for image modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showImageModal) return;
      switch (e.key) {
        case 'Escape': setShowImageModal(false); break;
        case '+': case '=': handleZoomIn(); break;
        case '-': handleZoomOut(); break;
        case '0': handleResetZoom(); break;
        case 'd': handleDownloadImage(currentImage, currentMediaType, null); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showImageModal, currentImage, currentMediaType, handleZoomIn, handleZoomOut, handleResetZoom, handleDownloadImage]);

  // Memoized VoiceMessage
  const VoiceMessage = useCallback(({ side = "right" }) => (
    <Flex
      bg={side === "right" ? "#1e1e1e" : "gray.700"}
      maxW={"350px"}
      p={3}
      borderRadius={"md"}
      direction="column"
      position="relative"
    >
      <Flex align="center" gap={3} mb={2}>
        <Icon as={FaMicrophone} boxSize={5} color="red.400" />
        <Text color="white" fontSize="sm">Voice Message {message.voiceDuration ? `(${formatTime(message.voiceDuration)})` : ""}</Text>
      </Flex>
      <Flex align="center" gap={3} mt={2}>
        <IconButton
          icon={isPlaying ? <FaPause /> : <FaPlay />}
          size="sm"
          colorScheme={isPlaying ? "red" : "blue"}
          isRound
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
        />
        <Progress
          value={playbackProgress}
          size="sm"
          width="100%"
          colorScheme="blue"
          bg="gray.700"
          borderRadius="full"
          transition="0.2s"
        />
        <Text color="white" fontSize="xs" width="45px">
          {formatTime(Math.floor((message.voiceDuration || 0) * playbackProgress / 100))}
        </Text>
      </Flex>
      <Box mt={2} display="none">
        <audio controls src={message.voice} />
      </Box>
      {ownMessage && message.seen && (
        <Box
          position="absolute"
          right="-20px"
          bottom="0"
          color="gray.500"
        >
          <BsCheck2All size={14} />
        </Box>
      )}
    </Flex>
  ), [isPlaying, playbackProgress, message.voice, message.voiceDuration, ownMessage, message.seen, togglePlay]);

  // Memoized MessageStatus
  const MessageStatus = useCallback(() => {
    if (!ownMessage) return null;
    let statusText = "Sent";
    if (message.isOptimistic) statusText = "Sending...";
    else if (message.seen) statusText = "Seen";
    return (
      <Tooltip label={statusText} placement="bottom" hasArrow>
        <Box
          position="absolute"
          right="-20px"
          bottom="0"
          color={message.seen ? "blue.400" : message.isOptimistic ? "yellow.500" : "gray.500"}
          transition="all 0.2s ease"
        >
          {getStatusIcon()}
        </Box>
      </Tooltip>
    );
  }, [ownMessage, message.isOptimistic, message.seen, getStatusIcon]);

  if (message.deletedForEveryone) {
    return (
      <Flex
        alignSelf={ownMessage ? "flex-end" : "flex-start"}
        bg="gray.800"
        p={2}
        borderRadius="md"
        maxW="350px"
        mb={3}
      >
        <Text fontSize="xs" fontStyle="italic" color="gray.400">
          This message was deleted
        </Text>
      </Flex>
    );
  }

  return (
    <>
      {ownMessage ? (
        <Flex gap={2} alignSelf={"flex-end"} mb={3} maxW="90%" className="message-item" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
          {/* Text message */}
          {message.text && (
            <Flex
              bg={message.isOptimistic ? "rgba(40, 40, 40, 0.6)" : "#1e1e1e"}
              maxW={"700px"} /* Significantly increased from 350px to 700px for much wider message bubbles */
              minW={0}
              p={4} /* Increased padding from 2.5 to 4 for more breathing room */
              borderRadius={"lg"}
              borderTopRightRadius="2px"
              position="relative"
              _hover={{ bg: message.isOptimistic ? "rgba(50, 50, 50, 0.6)" : "#2a2a2a" }}
              boxShadow="0px 1px 2px rgba(0,0,0,0.2)"
              direction="column"
              className="hover-effect"
              borderLeft={message.isFederated ? `3px solid ${getPlatformColor(message.platform)}` : "none"}
              style={{ overflowWrap: "break-word", wordBreak: "break-word" }}
            >
              {message.isFederated && (
                <Flex alignItems="center" gap={2} mb={2}>
                  {getPlatformIcon(message.platform)}
                  <Text fontSize="xs" color={getPlatformColor(message.platform)} fontWeight="medium">
                    {message.senderUsername || 'Unknown User'}
                  </Text>
                  <Badge size="xs" colorScheme={message.platform === 'telegram' ? 'blue' : message.platform === 'discord' ? 'purple' : 'green'}>
                    {message.platform}
                  </Badge>
                </Flex>
              )}
              <Text
                color={"white"}
                fontSize="sm"
                overflowWrap="break-word"
                wordBreak="break-word"
                whiteSpace="pre-wrap"
                sx={{ hyphens: "auto" }}
              >
                {message.text}
              </Text>
            </Flex>
          )}
          {/* Emoji message */}
          {message.emoji && (
            <Flex
              bg={"transparent"}
              maxW={"700px"} /* Increased from 350px to 700px for consistency */
              p={2}
              borderRadius={"md"}
              position="relative"
              justifyContent="center"
              alignItems="center"
            >
              <Text fontSize="4xl">{message.emoji}</Text>
            </Flex>
          )}
          {/* Image message */}
          {message.img && !imgLoaded && (
            <Flex mt={2} w={"200px"}>
              <Image
                src={message.img}
                hidden
                onLoad={() => setImgLoaded(true)}
                alt='Message image'
                borderRadius={"md"}
              />
              <Skeleton w={"200px"} h={"200px"} borderRadius={"md"} startColor="gray.700" endColor="gray.600" />
            </Flex>
          )}
          {message.img && imgLoaded && (
            <Flex
              mt={2}
              w={"200px"}
              position="relative"
            >
              <Image
                src={message.img}
                alt='Message image'
                borderRadius={"md"}
                cursor="pointer"
                _hover={{ opacity: 0.9 }}
                onClick={() => handleImageClick(message.img, "image")}
                className="optimized-image"
              />
              <MessageStatus />
            </Flex>
          )}
          {/* GIF message */}
          {message.gif && (
            <Flex
              mt={2}
              w={"200px"}
              position="relative"
            >
              <Image
                src={message.gif}
                alt='GIF'
                borderRadius={"md"}
                cursor="pointer"
                _hover={{ opacity: 0.9 }}
                onClick={() => handleImageClick(message.gif, "gif")}
                className="optimized-image"
              />
              <MessageStatus />
            </Flex>
          )}
          {/* File message */}
          {message.file && (
            <Flex
              mt={2}
              maxW={"700px"} /* Increased from 350px to 700px for consistency */
              position="relative"
              bg={message.isOptimistic ? "rgba(40, 40, 40, 0.6)" : "#1e1e1e"}
              p={3}
              borderRadius={"md"}
              align="center"
              gap={3}
              cursor="pointer"
              _hover={{ bg: "#2a2a2a" }}
              onClick={() => handleDownloadImage(message.file, "file", message)}
              transition="background-color 0.2s"
            >
              <Icon as={BsFileEarmarkFill} boxSize={6} color="blue.400" />
              <Box>
                <Text color="white" fontWeight="medium" fontSize="sm">
                  {message.fileName || "Document"}
                </Text>
                {message.fileSize > 0 && (
                  <Text color="gray.400" fontSize="xs">
                    {(message.fileSize / 1024).toFixed(2)} KB
                  </Text>
                )}
                <Text color="blue.400" fontSize="xs" mt={1}>
                  Click to download
                </Text>
              </Box>
              <MessageStatus />
            </Flex>
          )}
          {/* Voice message */}
          {message.voice && (
            <VoiceMessage side="right" />
          )}
          {/* Fallback for empty messages (no text, emoji, img, gif, voice, file) */}
          {!(message.text || message.emoji || message.img || message.gif || message.voice || message.file) && (
            <Flex
              bg="gray.700"
              maxW={"350px"}
              p={2.5}
              borderRadius={"lg"}
              alignSelf={ownMessage ? "flex-end" : "flex-start"}
              mb={2}
              justifyContent="center"
              alignItems="center"
            >
              <Text color="gray.400" fontSize="sm" fontStyle="italic">
                (Empty message)
              </Text>
            </Flex>
          )}
          {/* Flex for timestamp and status, within the main ownMessage Flex */}
          <Flex alignSelf="flex-end" align="center" gap={1} mt={1}>
            <Text fontSize="2xs" color="gray.500">
              {formatMessageTime(message.createdAt)}
            </Text>
            <MessageStatus />
          </Flex>
          {/* Message options menu */}
          <Menu placement="bottom-end" isLazy>
            <MenuButton
              as={IconButton}
              icon={<BsThreeDotsVertical />}
              variant="ghost"
              size="xs"
              color="gray.400"
              aria-label="Message options"
              _hover={{
                color: "white",
                bg: "rgba(0, 204, 133, 0.1)",
                borderColor: "rgba(0, 204, 133, 0.3)"
              }}
            />
            <MenuList
              minW="180px"
              bg="#101010"
              borderColor="gray.700"
              p={2}
              boxShadow="0 4px 12px rgba(0, 0, 0, 0.2)"
              className="glass-card"
            >
              <MenuItem
                icon={<FaTrash />}
                onClick={() => handleDelete(false)}
                bg="#101010"
                _hover={{
                  bg: "rgba(0, 204, 133, 0.1)",
                  color: "white"
                }}
                borderRadius="md"
              >
                Delete for me
              </MenuItem>
              <MenuItem
                icon={<FaTrash />}
                onClick={() => handleDelete(true)}
                bg="#101010"
                _hover={{
                  bg: "rgba(229, 62, 62, 0.1)",
                  color: "red.300"
                }}
                color="red.300"
                borderRadius="md"
              >
                Delete for everyone
              </MenuItem>
            </MenuList>
          </Menu>
        </Flex>
      ) : (
        <Flex gap={2} alignSelf={"flex-start"} mb={3} maxW="80%" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
          {/* Small user avatar for other user's messages or platform icon for federated */}
          {message.isFederated ? (
            <Box
              w="28px"
              h="28px"
              borderRadius="full"
              bg={getPlatformColor(message.platform)}
              display="flex"
              alignItems="center"
              justifyContent="center"
              alignSelf="flex-end"
              mb={1}
            >
              {getPlatformIcon(message.platform)}
            </Box>
          ) : (
            <Box
              w="28px"
              h="28px"
              borderRadius="full"
              bg="gray.600"
              backgroundImage={`url(${selectedConversation?.userProfilePic || '/placeholder-avatar.png'})`}
              backgroundSize="cover"
              backgroundPosition="center"
              alignSelf="flex-end"
              mb={1}
            />
          )}
          <Flex direction="column">
            {/* Text message */}
            {message.text && (
              <Flex
                bg="rgba(99, 99, 99, 0.35)"
                maxW={"350px"}
                minW={0}
                p={2.5}
                borderRadius={"lg"}
                borderTopLeftRadius="2px"
                boxShadow="0px 1px 2px rgba(0,0,0,0.2)"
                direction="column"
                borderLeft={message.isFederated ? `3px solid ${getPlatformColor(message.platform)}` : "none"}
                style={{ overflowWrap: "break-word", wordBreak: "break-word" }}
              >
                {message.isFederated && (
                  <Flex alignItems="center" gap={2} mb={2}>
                    {getPlatformIcon(message.platform)}
                    <Text fontSize="xs" color={getPlatformColor(message.platform)} fontWeight="medium">
                      {message.senderUsername || 'Unknown User'}
                    </Text>
                    <Badge size="xs" colorScheme={message.platform === 'telegram' ? 'blue' : message.platform === 'discord' ? 'purple' : 'green'}>
                      {message.platform}
                    </Badge>
                  </Flex>
                )}
                <Text
                  color={"white"}
                  fontSize="sm"
                  overflowWrap="break-word"
                  wordBreak="break-word"
                  whiteSpace="pre-wrap"
                  sx={{ hyphens: "auto" }}
                >
                  {message.text}
                </Text>
              </Flex>
            )}
            {/* Emoji message */}
            {message.emoji && (
              <Flex
                bg={"transparent"}
                maxW={"350px"}
                p={2}
                borderRadius={"md"}
                position="relative"
                justifyContent="center"
                alignItems="center"
              >
                <Text fontSize="4xl">{message.emoji}</Text>
              </Flex>
            )}
            {/* Image message */}
            {message.img && !imgLoaded && (
              <Flex mt={2} w={"200px"}>
                <Image
                  src={message.img}
                  hidden
                  onLoad={() => setImgLoaded(true)}
                  alt='Message image'
                  borderRadius={"md"}
                />
                <Skeleton w={"200px"} h={"200px"} borderRadius={"md"} startColor="gray.700" endColor="gray.600" />
              </Flex>
            )}
            {message.img && imgLoaded && (
              <Flex
                mt={2}
                w={"200px"}
                position="relative"
              >
                <Image
                  src={message.img}
                  alt='Message image'
                  borderRadius={"md"}
                  cursor="pointer"
                  _hover={{ opacity: 0.9 }}
                  onClick={() => handleImageClick(message.img, "image")}
                  className="optimized-image"
                />
              </Flex>
            )}
            {/* GIF message */}
            {message.gif && (
              <Flex
                mt={2}
                w={"200px"}
                position="relative"
              >
                <Image
                  src={message.gif}
                  alt='GIF'
                  borderRadius={"md"}
                  cursor="pointer"
                  _hover={{ opacity: 0.9 }}
                  onClick={() => handleImageClick(message.gif, "gif")}
                  className="optimized-image"
                />
                <MessageStatus />
              </Flex>
            )}
            {/* File message */}
            {message.file && (
              <Flex
                mt={2}
                maxW={"350px"}
                position="relative"
                bg={"rgba(99, 99, 99, 0.35)"}
                p={3}
                borderRadius={"md"}
                align="center"
                gap={3}
                cursor="pointer"
                _hover={{ bg: "#2a2a2a" }}
                onClick={() => handleDownloadImage(message.file, "file", message)}
                transition="background-color 0.2s"
              >
                <Icon as={BsFileEarmarkFill} boxSize={6} color="blue.400" />
                <Box>
                  <Text color="white" fontWeight="medium" fontSize="sm">
                    {message.fileName || "Document"}
                  </Text>
                  {message.fileSize > 0 && (
                    <Text color="gray.400" fontSize="xs">
                      {(message.fileSize / 1024).toFixed(2)} KB
                    </Text>
                  )}
                  <Text color="blue.400" fontSize="xs" mt={1}>
                    Click to download
                  </Text>
                </Box>
                <MessageStatus />
              </Flex>
            )}
            {/* Voice message */}
            {message.voice && (
              <VoiceMessage side="left" />
            )}
            {/* Fallback for empty messages (no text, emoji, img, gif, voice, file) */}
            {!(message.text || message.emoji || message.img || message.gif || message.voice || message.file) && (
              <Flex
                bg="gray.700"
                maxW={"350px"}
                p={2.5}
                borderRadius={"lg"}
                alignSelf={ownMessage ? "flex-end" : "flex-start"}
                mb={2}
                justifyContent="center"
                alignItems="center"
              >
                <Text color="gray.400" fontSize="sm" fontStyle="italic">
                  (Empty message)
                </Text>
              </Flex>
            )}
            {/* Flex for timestamp and status, within the main other-user Flex */}
            <Flex alignSelf="flex-end" align="center" gap={1} mt={1}>
              <Text fontSize="2xs" color="gray.500">
                {formatMessageTime(message.createdAt)}
              </Text>
              <MessageStatus />
            </Flex>
          </Flex>
        </Flex>
      )}
      {/* Image/GIF Modal */}
      <Modal isOpen={showImageModal} onClose={() => setShowImageModal(false)} isCentered size="4xl" motionPreset="scale">
        <ModalOverlay />
        <ModalContent bg="rgba(20, 20, 20, 0.95)" boxShadow="lg" borderRadius="xl" maxW="90vw" maxH="90vh">
          <Box position="absolute" top={2} right={2} zIndex={2}>
            <IconButton
              icon={<CloseIcon />}
              variant="ghost"
              colorScheme="whiteAlpha"
              size="lg"
              borderRadius="full"
              onClick={() => setShowImageModal(false)}
              aria-label="Close modal"
            />
          </Box>
          <ModalBody p={0} display="flex" alignItems="center" justifyContent="center" h="100vh">
            <Flex direction="column" align="center" justify="center" w="100%" h="100%" position="relative">
              {isImageLoading && (
                <Spinner size="xl" color="white" position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" />
              )}
              <Box overflow="hidden" maxW="90vw" maxH="80vh" transition="transform 0.3s ease">
                <Image
                  src={currentImage}
                  maxH="80vh"
                  maxW="90vw"
                  objectFit="contain"
                  borderRadius="md"
                  transform={`scale(${zoomLevel})`}
                  transition="transform 0.2s ease"
                  onLoad={() => setIsImageLoading(false)}
                  className="optimized-image"
                />
              </Box>
              {/* Zoom controls */}
              <Flex mt={4} gap={2}>
                <IconButton icon={<MinusIcon />} variant="ghost" colorScheme="whiteAlpha" onClick={handleZoomOut} aria-label="Zoom out" isDisabled={zoomLevel <= 0.5} />
                <Button variant="ghost" colorScheme="whiteAlpha" onClick={handleResetZoom} size="sm">{Math.round(zoomLevel * 100)}%</Button>
                <IconButton icon={<AddIcon />} variant="ghost" colorScheme="whiteAlpha" onClick={handleZoomIn} aria-label="Zoom in" isDisabled={zoomLevel >= 3} />
              </Flex>
              {/* Download button */}
              <Button mt={4} colorScheme="blue" leftIcon={<DownloadIcon />} onClick={() => handleDownloadImage(currentImage, currentMediaType, null)} size="md" borderRadius="full" px={6}>
                Download {currentMediaType === "file" ? "File" : "Image"}
              </Button>
              {/* Keyboard shortcuts help */}
              <Text mt={4} fontSize="xs" color="whiteAlpha.700" textAlign="center">
                Keyboard shortcuts: <br />
                <Box as="span" fontWeight="bold">+</Box> to zoom in, <Box as="span" fontWeight="bold">-</Box> to zoom out, <Box as="span" fontWeight="bold">0</Box> to reset zoom, <Box as="span" fontWeight="bold">d</Box> to download, <Box as="span" fontWeight="bold">Esc</Box> to close
              </Text>
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>
      {/* Delete Confirmation Dialog */}
      <AlertDialog isOpen={isDeleteAlertOpen} leastDestructiveRef={cancelRef} onClose={() => setIsDeleteAlertOpen(false)} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent bg="#101010" borderColor="gray.700" borderWidth="1px" boxShadow="0 8px 32px 0 rgba(0, 0, 0, 0.3)" className="glass-card">
            <AlertDialogHeader fontSize="lg" fontWeight="bold">Delete Message</AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete this message{deleteForEveryone ? " for everyone" : ""}?
              {deleteForEveryone && " This cannot be undone."}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setIsDeleteAlertOpen(false)} variant="outline" borderColor="gray.600" color="white" bg="#101010" _hover={{ bg: "#1a1a1a" }}>Cancel</Button>
              <Button onClick={confirmDelete} ml={3} bg="#101010" color="red.300" borderWidth="1px" borderColor="red.500" _hover={{ bg: "#1a1a1a" }}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
});

Message.displayName = 'Message';

export default Message;
