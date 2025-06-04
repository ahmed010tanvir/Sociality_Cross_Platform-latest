import { Avatar } from "@chakra-ui/avatar";
import { Box, Flex, Link, Text, VStack, HStack, Divider } from "@chakra-ui/layout";
import { Menu, MenuButton, MenuItem, MenuList } from "@chakra-ui/menu";
import { Portal } from "@chakra-ui/portal";
import { Button, useToast, Tabs, TabList, Tab, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, FormControl, Textarea, Image, IconButton } from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import { CgMoreO } from "react-icons/cg";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { ChatCircle, Copy, PencilSimple } from "phosphor-react";
import { userAtom, conversationsAtom } from "../atoms";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import useFollowUnfollow from "../hooks/useFollowUnfollow";
import FollowButton from "./FollowButton";
import FollowModal from "./FollowModal";
import { useState, useEffect } from "react";
import "./NoBorderTab.css";
import { fetchWithSession } from "../utils/api";

const UserHeader = ({ user, selectedTab, onTabChange, onUserUpdate }) => {
    const [isFollowOpen, setIsFollowOpen] = useState(false);
    const [isMessageOpen, setIsMessageOpen] = useState(false);
    const [isProfilePicModalOpen, setIsProfilePicModalOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [followersCount, setFollowersCount] = useState(user?.followers?.length || 0);
    const [followingCount, setFollowingCount] = useState(user?.following?.length || 0);

    const toast = useToast();
    const currentUser = useRecoilValue(userAtom);
    // Use destructuring to get only what we need from the hook
    useFollowUnfollow(user, onUserUpdate);

    // Handle back button for profile picture modal
    useEffect(() => {
        const handleBackButton = () => {
            if (isProfilePicModalOpen) {
                setIsProfilePicModalOpen(false);
            }
        };

        // Listen for popstate event (back button)
        window.addEventListener('popstate', handleBackButton);

        return () => {
            window.removeEventListener('popstate', handleBackButton);
        };
    }, [isProfilePicModalOpen]);

    // Update counts when user data changes
    useEffect(() => {
        if (user) {
            // Ensure followers and following exist and are arrays
            const followers = Array.isArray(user.followers) ? user.followers : [];
            const following = Array.isArray(user.following) ? user.following : [];

            const newFollowersCount = followers.length;
            const newFollowingCount = following.length;

            // Only update if counts have changed to avoid unnecessary re-renders
            if (newFollowersCount !== followersCount) {
                setFollowersCount(newFollowersCount);
            }

            if (newFollowingCount !== followingCount) {
                setFollowingCount(newFollowingCount);
            }
        }
    }, [user, followersCount, followingCount]);

    const tabNameToIndex = {
        posts: 0,
        replies: 1,
        reposts: 2,
    };

    const tabIndexToName = {
        0: "posts",
        1: "replies",
        2: "reposts",
    };

    const handleTabChange = (index) => {
        onTabChange(tabIndexToName[index]);
    };

    const copyURL = () => {
        const currentURL = window.location.href;
        navigator.clipboard.writeText(currentURL).then(() => {
            toast({
                title: "Success.",
                status: "success",
                description: "Profile link copied.",
                duration: 3000,
                isClosable: true,
            });
        });
    };



    return (
        <VStack gap={4} alignItems={"start"}>
            <Flex justifyContent={"space-between"} w={"full"}>
                <Box>
                    <Text fontSize={"2xl"} fontWeight={"bold"}>
                        {user.name}
                    </Text>
                    <Flex gap={2} alignItems={"center"}>
                        <Text fontSize={"sm"}>{user.username}</Text>
                        <Text fontSize={"xs"} bg={"gray.dark"} color={"gray.light"} p={1} borderRadius={"full"}>
                            Sociality.net
                        </Text>
                    </Flex>
                </Box>
                <Box>
                    {user.profilePic && (
                        <Avatar
                            name={user.name}
                            src={user.profilePic}
                            size={{
                                base: "md",
                                md: "xl",
                            }}
                            cursor="pointer"
                            onClick={() => {
                                // Push a new history state before opening the modal
                                window.history.pushState({ modal: 'profilePic' }, '');
                                setIsProfilePicModalOpen(true);
                            }}
                        />
                    )}
                    {!user.profilePic && (
                        <Avatar
                            name={user.name}
                            src='https://bit.ly/broken-link'
                            size={{
                                base: "md",
                                md: "xl",
                            }}
                            cursor="pointer"
                            onClick={() => {
                                // Push a new history state before opening the modal
                                window.history.pushState({ modal: 'profilePic' }, '');
                                setIsProfilePicModalOpen(true);
                            }}
                        />
                    )}
                </Box>
            </Flex>

            <Text>{user.bio}</Text>

            {currentUser?._id !== user._id && (
                <Flex w="full" gap={2}>
                    <FollowButton
                        userId={user._id}
                        initialIsFollowing={
                            currentUser?.following?.some(following => {
                                const followingId = typeof following === 'string' ? following : following?._id;
                                return followingId === user._id;
                            }) || false
                        }
                        size="sm"
                    />
                    <Button
                        size="sm"
                        bg="rgba(0, 121, 185, 0.2)"
                        color="white"
                        borderWidth="1px"
                        borderColor="rgba(0, 121, 185, 0.5)"
                        _hover={{
                            bg: "rgba(0, 121, 185, 0.3)",
                            transform: "translateY(-2px)",
                            borderColor: "rgba(0, 121, 185, 0.7)"
                        }}
                        transition="all 0.2s"
                        borderRadius="md" // Changed from "full" to "md" for rounded rectangle
                        fontWeight="medium"
                        onClick={() => setIsMessageOpen(true)}
                        boxShadow="0 2px 6px rgba(0, 0, 0, 0.1)"
                        px={5}
                        py={4}
                        _active={{
                            transform: "scale(0.98)",
                            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
                        }}
                        leftIcon={<ChatCircle size={16} />}
                    >
                        Message
                    </Button>
                </Flex>
            )}
            <Flex w={"full"} justifyContent={"space-between"}>
                <HStack gap={2} alignItems={"center"}>
                    <Text
                        cursor="pointer"
                        onClick={() => setIsFollowOpen(true)}
                        fontWeight="medium"
                        _hover={{ textDecoration: 'underline' }}
                    >
                        {followersCount || 0} followers
                    </Text>
                    <Text>
                        •
                    </Text>
                    <Text
                        cursor="pointer"
                        onClick={() => setIsFollowOpen(true)}
                        fontWeight="medium"
                        _hover={{ textDecoration: 'underline' }}
                    >
                        {followingCount || 0} following
                    </Text>
                </HStack>

                <Flex>
                    <Box className='icon-container'>
                        <Menu>
                            <MenuButton>
                                <CgMoreO
                                    size={24}
                                    cursor={"pointer"}
                                    color="gray.500"
                                    style={{
                                        transition: "color 0.2s ease-in-out"
                                    }}
                                    _hover={{
                                        color: "white"
                                    }}
                                />
                            </MenuButton>
                            <Portal>
                                <MenuList
                                    bg="#101010"
                                    borderColor="gray.700"
                                    minW="180px"
                                    p={2}
                                    boxShadow="0 4px 12px rgba(0, 0, 0, 0.2)"
                                    className="glass-card"
                                >
                                    <MenuItem
                                        icon={<Copy size={14} />}
                                        bg="#101010"
                                        _hover={{
                                            bg: "rgba(0, 204, 133, 0.1)",
                                            color: "white"
                                        }}
                                        borderRadius="md"
                                        onClick={copyURL}
                                    >
                                        Copy link
                                    </MenuItem>
                                </MenuList>
                            </Portal>
                        </Menu>
                    </Box>
                </Flex>
            </Flex>

            {currentUser?._id === user._id && (
                <Box w="full">
                    <Link as={RouterLink} to='/update' style={{ width: "100%" }}>
                        <Button
                            size="lg"
                            bg="rgba(0, 204, 133, 0.1)"
                            color="white"
                            borderWidth="1px"
                            borderColor="rgba(0, 204, 133, 0.5)"
                            _hover={{
                                bg: "rgba(0, 204, 133, 0.2)",
                                transform: "translateY(-2px)",
                                borderColor: "rgba(0, 204, 133, 0.7)"
                            }}
                            transition="all 0.2s"
                            borderRadius="md" // Changed from "full" to "md" for rounded rectangle
                            fontWeight="medium"
                            w="full"
                            boxShadow="0 2px 6px rgba(0, 0, 0, 0.1)"
                            px={6}
                            py={4}
                            _active={{
                                transform: "scale(0.98)",
                                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
                            }}
                            leftIcon={<PencilSimple size={16} />}
                        >
                            Edit Profile
                        </Button>
                    </Link>
                </Box>
            )}

            <Tabs
                index={tabNameToIndex[selectedTab]}
                onChange={handleTabChange}
                variant='unstyled'
                w="full"
                border="none"
                style={{ border: "none" }}
                className="no-border-tabs"
            >
                <TabList justifyContent="space-around" border="none" style={{ border: "none" }} className="no-border-tablist">
                    <Tab
                        as="div"
                        borderRadius="md"
                        bg="rgba(0, 0, 0, 0.2)"
                        backdropFilter="blur(8px)"
                        boxShadow="0 4px 12px rgba(0, 0, 0, 0.1)"
                        px={6}
                        py={2}
                        transition="all 0.3s ease"
                        border="none"
                        style={{
                            border: "none",
                            outline: "none",
                            borderWidth: 0,
                            borderStyle: "none"
                        }}
                        _selected={{
                            boxShadow: "0 4px 18px rgba(0, 0, 0, 0.25)",
                            border: "none",
                            borderWidth: 0
                        }}
                        _hover={{
                            bg: "rgba(0, 204, 133, 0.1)",
                            boxShadow: "0 4px 15px rgba(0, 204, 133, 0.15)",
                            border: "none",
                            borderWidth: 0
                        }}
                        _focus={{
                            border: "none",
                            outline: "none",
                            borderWidth: 0
                        }}
                        className="glass-tab no-border-tab"
                    >
                        Posts
                    </Tab>
                    <Tab
                        as="div"
                        borderRadius="md"
                        bg="rgba(0, 0, 0, 0.2)"
                        backdropFilter="blur(8px)"
                        boxShadow="0 4px 12px rgba(0, 0, 0, 0.1)"
                        px={6}
                        py={2}
                        transition="all 0.3s ease"
                        border="none"
                        style={{
                            border: "none",
                            outline: "none",
                            borderWidth: 0,
                            borderStyle: "none"
                        }}
                        _selected={{
                            boxShadow: "0 4px 18px rgba(0, 0, 0, 0.25)",
                            border: "none",
                            borderWidth: 0
                        }}
                        _hover={{
                            bg: "rgba(0, 204, 133, 0.1)",
                            boxShadow: "0 4px 15px rgba(0, 204, 133, 0.15)",
                            border: "none",
                            borderWidth: 0
                        }}
                        _focus={{
                            border: "none",
                            outline: "none",
                            borderWidth: 0
                        }}
                        className="glass-tab no-border-tab"
                    >
                        Replies
                    </Tab>
                    <Tab
                        as="div"
                        borderRadius="md"
                        bg="rgba(0, 0, 0, 0.2)"
                        backdropFilter="blur(8px)"
                        boxShadow="0 4px 12px rgba(0, 0, 0, 0.1)"
                        px={6}
                        py={2}
                        transition="all 0.3s ease"
                        border="none"
                        style={{
                            border: "none",
                            outline: "none",
                            borderWidth: 0,
                            borderStyle: "none"
                        }}
                        _selected={{
                            boxShadow: "0 4px 18px rgba(0, 0, 0, 0.25)",
                            border: "none",
                            borderWidth: 0
                        }}
                        _hover={{
                            bg: "rgba(0, 204, 133, 0.1)",
                            boxShadow: "0 4px 15px rgba(0, 204, 133, 0.15)",
                            border: "none",
                            borderWidth: 0
                        }}
                        _focus={{
                            border: "none",
                            outline: "none",
                            borderWidth: 0
                        }}
                        className="glass-tab no-border-tab"
                    >
                        Reposts
                    </Tab>
                </TabList>
            </Tabs>

            {/* Separator for all tabs when viewing own profile */}
            {currentUser?._id === user._id && (
                <Divider
                    my={4}
                    borderColor="rgba(255, 255, 255, 0.1)"
                    borderWidth="1px"
                    w="full"
                    opacity={0.5}
                />
            )}

            {/* Follow Modal with tabs */}
            {user && (
                <>
                    <FollowModal
                        isOpen={isFollowOpen}
                        onClose={() => {
                            setIsFollowOpen(false);
                            // Refresh user data and counts when modal closes
                            if (user) {
                                // Force a refresh of the user data to get the latest counts
                                fetchWithSession(`/api/users/profile/${user.username}`)
                                    .then(res => {
                                        if (res.ok) {
                                            return res.json();
                                        } else {
                                            throw new Error('Failed to fetch user data');
                                        }
                                    })
                                    .then(data => {
                                        setFollowersCount(data.followers?.length || 0);
                                        setFollowingCount(data.following?.length || 0);

                                        // Update the parent component
                                        if (onUserUpdate) {
                                            onUserUpdate(data);
                                        }
                                    })
                                    .catch(() => {
                                        toast({
                                            title: "Error",
                                            description: "Failed to refresh user data",
                                            status: "error",
                                            duration: 3000,
                                            isClosable: true
                                        });
                                    });
                            }
                        }}
                        username={user.username}
                        onUserUpdate={onUserUpdate}
                    />
                </>
            )}

            {/* Profile Picture Modal */}
            {user && (
                <Modal
                    isOpen={isProfilePicModalOpen}
                    onClose={() => setIsProfilePicModalOpen(false)}
                    size="full"
                    isCentered
                    returnFocusOnClose={false}
                    blockScrollOnMount={false}
                >
                    <ModalOverlay bg="blackAlpha.900" backdropFilter="blur(10px)" />
                    <ModalContent bg="transparent" boxShadow="none" maxW="100vw" maxH="100vh">
                        {/* Back button */}
                        <IconButton
                            icon={<ArrowBackIcon boxSize={6} />}
                            aria-label="Back to previous page"
                            position="absolute"
                            top={4}
                            left={4}
                            zIndex={10}
                            variant="ghost"
                            color="white"
                            _hover={{ color: "rgba(0, 204, 133, 0.9)" }}
                            onClick={() => {
                                setIsProfilePicModalOpen(false);
                            }}
                            size="md"
                        />
                        <ModalBody
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            p={0}
                            position="relative"
                        >
                            <Box position="relative">
                                {user.profilePic ? (
                                    <Image
                                        src={user.profilePic}
                                        maxH="90vh"
                                        maxW="90vw"
                                        objectFit="contain"
                                        borderRadius="full"
                                    />
                                ) : (
                                    <Flex
                                        width="90vw"
                                        height="90vh"
                                        maxW="500px"
                                        maxH="500px"
                                        borderRadius="full"
                                        bg="gray.600"
                                        color="white"
                                        fontSize="8xl"
                                        alignItems="center"
                                        justifyContent="center"
                                    >
                                        {user.name ? user.name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                                    </Flex>
                                )}
                            </Box>
                        </ModalBody>
                    </ModalContent>
                </Modal>
            )}

            {/* Message Modal */}
            {user && currentUser && currentUser._id !== user._id && (
                <Modal isOpen={isMessageOpen} onClose={() => setIsMessageOpen(false)}>
                    <ModalOverlay />
                    <ModalContent bg="gray.dark" color="white">
                        <ModalHeader>Message {user.username}</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody pb={6}>
                            <FormControl>
                                <Textarea
                                    placeholder={`Write a message to ${user.username}...`}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    size="sm"
                                    resize="vertical"
                                    minH="100px"
                                />
                            </FormControl>
                        </ModalBody>

                        <ModalFooter>
                            <SendMessageButton
                                message={message}
                                recipientId={user._id}
                                recipientUsername={user.username}
                                onMessageSent={() => {
                                    setMessage("");
                                    setIsMessageOpen(false);
                                }}
                            />
                            <Button
                                bg="transparent"
                                color="white"
                                borderWidth="1px"
                                borderColor="gray.600"
                                _hover={{
                                    bg: "rgba(255, 255, 255, 0.1)",
                                    transform: "translateY(-2px)",
                                    borderColor: "gray.500"
                                }}
                                transition="all 0.2s"
                                borderRadius="md" // Changed from "full" to "md" for rounded rectangle
                                fontWeight="medium"
                                onClick={() => setIsMessageOpen(false)}
                                boxShadow="0 2px 6px rgba(0, 0, 0, 0.1)"
                                px={5}
                                _active={{
                                    transform: "scale(0.98)",
                                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
                                }}
                                leftIcon={
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                }
                            >
                                Cancel
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            )}
        </VStack>
    );
};

// Create a separate component for handling the message sending functionality
const SendMessageButton = ({ message, recipientId, recipientUsername, onMessageSent }) => {
    const [isSending, setIsSending] = useState(false);
    const toast = useToast();
    const navigate = useNavigate();
    const setConversations = useSetRecoilState(conversationsAtom);
    const currentUser = useRecoilValue(userAtom);

    const handleSendMessage = async () => {
        if (!message.trim()) return;
        if (isSending) return;

        setIsSending(true);
        try {
            const res = await fetchWithSession("/api/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text: message,
                    recipientId,
                }),
            });

            const data = await res.json();

            if (data.error) {
                toast({
                    title: "Error",
                    description: data.error,
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
                return;
            }

            // Create or update the conversation in the conversations atom
            setConversations(prev => {
                // Check if conversation already exists
                const existingConvIndex = prev.findIndex(
                    conv => conv.participants.some(p => p._id === recipientId)
                );

                if (existingConvIndex >= 0) {
                    // Update existing conversation
                    const updatedConversations = [...prev];
                    updatedConversations[existingConvIndex] = {
                        ...updatedConversations[existingConvIndex],
                        lastMessage: {
                            text: message,
                            sender: currentUser._id,
                        },
                    };
                    return updatedConversations;
                } else {
                    // Create new conversation
                    const newConversation = {
                        _id: data.conversationId,
                        participants: [{
                            _id: recipientId,
                            username: recipientUsername,
                            profilePic: currentUser.profilePic,
                        }],
                        lastMessage: {
                            text: message,
                            sender: currentUser._id,
                        },
                    };
                    return [...prev, newConversation];
                }
            });

            toast({
                title: "Message sent",
                status: "success",
                duration: 3000,
                isClosable: true,
            });

            // Call the callback to close the modal and reset the form
            onMessageSent();

            // Navigate to the chat page
            navigate('/chat');

        } catch (error) {
            toast({
                title: "Error",
                description: error.message,
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Button
            bg="rgba(0, 121, 185, 0.2)"
            color="white"
            borderWidth="1px"
            borderColor="rgba(0, 121, 185, 0.5)"
            _hover={{
                bg: "rgba(0, 121, 185, 0.3)",
                transform: "translateY(-2px)",
                borderColor: "rgba(0, 121, 185, 0.7)"
            }}
            transition="all 0.2s"
            borderRadius="md" // Changed from "full" to "md" for rounded rectangle
            fontWeight="medium"
            mr={3}
            isDisabled={!message.trim()}
            onClick={handleSendMessage}
            isLoading={isSending}
            boxShadow="0 2px 6px rgba(0, 0, 0, 0.1)"
            px={5}
            _active={{
                transform: "scale(0.98)",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
            }}
            leftIcon={
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            }
        >
            Send
        </Button>
    );
};

export default UserHeader;
