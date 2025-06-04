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

const DirectFollowingList = ({ isOpen, onClose, username }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingIds, setProcessingIds] = useState({});
    const currentUser = useRecoilValue(userAtom);
    const setCurrentUser = useSetRecoilState(userAtom);
    const toast = useToast();

    // Fetch following users directly from the current user state
    useEffect(() => {
        const fetchFollowing = async () => {
            if (!isOpen || !currentUser) return;

            setIsLoading(true);

            try {
                // Get fresh user data to ensure we have the latest following list
                const res = await fetchWithSession(`/api/users/profile/${username}`);
                if (res.ok) {
                    const userData = await res.json();

                    // Set following users from the fresh data
                    console.log("Fresh following data:", userData.following);
                    setUsers(userData.following || []);
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
    }, [isOpen, username, currentUser]);

    // Handle unfollow action
    const handleUnfollow = async (userId) => {
        if (processingIds[userId]) return; // Prevent multiple clicks

        // Set processing state
        setProcessingIds(prev => ({ ...prev, [userId]: true }));

        try {
            // Remove the user from the list immediately for better UX
            setUsers(prev => prev.filter(user => user._id !== userId));

            // Make the API call to unfollow
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

            // Update current user state
            if (currentUser) {
                const updatedFollowing = currentUser.following.filter(id => {
                    const followingId = typeof id === 'string' ? id : id._id;
                    return followingId !== userId;
                });

                const updatedUser = {
                    ...currentUser,
                    following: updatedFollowing
                };

                // Update the current user state
                setCurrentUser(updatedUser);

                // Update localStorage
                localStorage.setItem('user-threads', JSON.stringify(updatedUser));
            }

            // Show success message
            toast({
                title: 'Success',
                description: 'User unfollowed',
                status: 'success',
                duration: 3000,
                isClosable: true
            });

            // Close the modal if the list becomes empty
            if (users.length === 1) {
                setTimeout(() => {
                    onClose();
                }, 300);
            }

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
                            You are not following anyone
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

export default DirectFollowingList;
