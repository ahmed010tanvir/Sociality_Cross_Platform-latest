import { useState, useEffect } from "react";
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalCloseButton,
    ModalBody,
    Text,
    VStack,
    Avatar,
    HStack,
    Divider,
    Link,
    Spinner,
    Center,
    Flex,
    Button,
    useToast,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { userAtom } from "../atoms";
import { fetchWithSession } from "../utils/api";

const FollowingList = ({ isOpen, onClose, username, onUserUpdate }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingIds, setProcessingIds] = useState({});
    const currentUser = useRecoilValue(userAtom);
    const setCurrentUser = useSetRecoilState(userAtom);
    const toast = useToast();

    // Fetch following users when modal opens
    useEffect(() => {
        const fetchFollowing = async () => {
            if (!isOpen || !username) return;

            setIsLoading(true);
            try {
                const res = await fetchWithSession(`/api/users/profile/${username}`);
                if (res.ok) {
                    const userData = await res.json();
                    // Set following users
                    setUsers(userData.following || []);
                    console.log("Fetched following:", userData.following);
                } else {
                    const errorData = await res.json().catch(() => ({ error: 'Failed to fetch user data' }));
                    console.error("Error fetching user data:", errorData.error);
                    setUsers([]);
                }
            } catch (error) {
                console.error("Error fetching following:", error);
                setUsers([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFollowing();
    }, [isOpen, username]);

    // Handle unfollow action
    const handleUnfollow = async (userId) => {
        if (processingIds[userId]) return; // Prevent multiple clicks

        // Set processing state
        setProcessingIds(prev => ({ ...prev, [userId]: true }));

        try {
            const res = await fetchWithSession(`/api/users/follow/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (res.ok) {
                await res.json();
            } else {
                const errorData = await res.json().catch(() => ({ error: 'Failed to unfollow user' }));
                toast({
                    title: 'Error',
                    description: errorData.error || 'Failed to unfollow user',
                    status: 'error',
                    duration: 3000,
                    isClosable: true
                });
                return;
            }

            // Remove the unfollowed user from the list immediately
            setUsers(prevUsers => prevUsers.filter(user => user._id !== userId));

            // Close the modal after a short delay to show the user being removed
            setTimeout(() => {
                onClose();
            }, 300);

            // Update current user state
            if (currentUser) {
                // Make sure following exists and is an array
                const updatedFollowing = Array.isArray(currentUser.following)
                    ? currentUser.following.filter(id => {
                        const followingId = typeof id === 'string' ? id : id?._id;
                        return followingId !== userId;
                      })
                    : [];

                // Update the current user state
                const updatedUser = {
                    ...currentUser,
                    following: updatedFollowing
                };

                setCurrentUser(updatedUser);

                // Update localStorage to persist changes
                localStorage.setItem('user-threads', JSON.stringify(updatedUser));

                // Update parent component if needed
                if (onUserUpdate) {
                    onUserUpdate(updatedUser);
                }
            }

            // Show success message
            toast({
                title: 'Success',
                description: 'User unfollowed',
                status: 'success',
                duration: 3000,
                isClosable: true
            });

            // We don't need to refresh the entire page anymore since we're handling the UI update directly
            // and closing the modal. The counts will update when the user navigates or refreshes.

        } catch (error) {
            console.error('Error unfollowing user:', error);
            toast({
                title: 'Error',
                description: 'Failed to unfollow user',
                status: 'error',
                duration: 3000,
                isClosable: true
            });
        } finally {
            // Clear processing state
            setProcessingIds(prev => ({ ...prev, [userId]: false }));
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
            <ModalOverlay />
            <ModalContent bg={"gray.dark"} color={"white"}>
                <ModalHeader>Following</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    {isLoading && (
                        <Center py={8}>
                            <Spinner size="xl" color="blue.500" />
                        </Center>
                    )}

                    {!isLoading && users.length === 0 && (
                        <Text textAlign="center" py={4}>
                            No following found
                        </Text>
                    )}

                    {!isLoading && users.length > 0 && (
                        <VStack align="stretch" spacing={4} pb={4}>
                            {users.map((user, index) => {
                                if (!user || !user.username) {
                                    return null;
                                }

                                return (
                                    <div key={user._id || index}>
                                        <HStack spacing={4} align="center" justify="space-between">
                                            <HStack spacing={4} align="center">
                                                <Avatar
                                                    size="md"
                                                    name={user.username || 'User'}
                                                    src={user.profilePic}
                                                />
                                                <Flex direction="column">
                                                    <Link
                                                        as={RouterLink}
                                                        to={`/${user.username}`}
                                                        fontWeight="medium"
                                                        _hover={{ textDecoration: 'underline' }}
                                                        onClick={onClose}
                                                    >
                                                        {user.username || 'Unknown User'}
                                                    </Link>
                                                    {user.name && (
                                                        <Text fontSize="sm" color="gray.500">
                                                            {user.name}
                                                        </Text>
                                                    )}
                                                </Flex>
                                            </HStack>

                                            {currentUser && currentUser._id !== user._id && (
                                                <Button
                                                    size="sm"
                                                    colorScheme="gray"
                                                    variant="outline"
                                                    onClick={() => handleUnfollow(user._id)}
                                                    isLoading={processingIds[user._id]}
                                                >
                                                    Unfollow
                                                </Button>
                                            )}
                                        </HStack>
                                        {index < users.length - 1 && <Divider mt={2} />}
                                    </div>
                                );
                            })}
                        </VStack>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default FollowingList;
