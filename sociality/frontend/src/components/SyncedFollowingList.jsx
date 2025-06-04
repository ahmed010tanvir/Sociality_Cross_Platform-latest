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
    Box,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { userAtom } from "../atoms";

const SyncedFollowingList = ({ isOpen, onClose, username, onUserUpdate }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingIds, setProcessingIds] = useState({});

    const currentUser = useRecoilValue(userAtom);
    const setCurrentUser = useSetRecoilState(userAtom);
    const toast = useToast();

    // Fetch following users directly from the backend every time the modal opens
    useEffect(() => {
        const fetchFollowing = async () => {
            if (!isOpen) return;

            setIsLoading(true);
            setUsers([]); // Clear previous data

            try {
                console.log('Fetching following data for:', username);

                // Get fresh user data
                const res = await fetch(`/api/users/profile/${username}`);
                const userData = await res.json();

                if (userData.error) {
                    console.error("Error fetching user data:", userData.error);
                    setUsers([]);
                    return;
                }

                // Log the following data
                console.log('Following data from backend:', userData.following);

                // Set following users
                setUsers(userData.following || []);

                // If this is the current user, update the global state
                if (currentUser && currentUser.username === username) {
                    console.log('Updating current user state with fresh data');
                    setCurrentUser(userData);
                    localStorage.setItem('user-threads', JSON.stringify(userData));
                }

                // Update the parent component
                if (onUserUpdate) {
                    onUserUpdate(userData);
                }
            } catch (error) {
                console.error("Error fetching following:", error);
                setUsers([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFollowing();
    }, [isOpen, username, currentUser, onUserUpdate, setCurrentUser]);

    // Handle unfollow action with direct backend update
    const handleUnfollow = async (userId) => {
        if (processingIds[userId]) return; // Prevent multiple clicks

        // Set processing state
        setProcessingIds(prev => ({ ...prev, [userId]: true }));

        try {
            console.log('Unfollowing user:', userId);

            // Make the API call to unfollow
            const res = await fetch(`/api/users/follow/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await res.json();

            if (data.error) {
                console.error('Error unfollowing user:', data.error);
                toast({
                    title: 'Error',
                    description: data.error,
                    status: 'error',
                    duration: 3000,
                    isClosable: true
                });
                return;
            }

            console.log('Successfully unfollowed user');

            // Remove the user from the list immediately for better UX
            setUsers(prev => prev.filter(user => user._id !== userId));

            // Get fresh user data after unfollowing
            const userRes = await fetch(`/api/users/profile/${currentUser.username}`);
            const userData = await userRes.json();

            if (!userData.error) {
                console.log('Updated user data after unfollow:', {
                    following: userData.following?.length || 0
                });

                // Update the current user state
                setCurrentUser(userData);

                // Update localStorage
                localStorage.setItem('user-threads', JSON.stringify(userData));

                // Update the parent component
                if (onUserUpdate) {
                    onUserUpdate(userData);
                }
            }

            // Don't force a refresh to avoid infinite loop
            // setRefreshTrigger(prev => prev + 1);

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
                    {isLoading ? (
                        <Center py={8}>
                            <VStack>
                                <Spinner size="xl" color="blue.500" />
                                <Text mt={4}>Loading following list...</Text>
                            </VStack>
                        </Center>
                    ) : (
                        <>
                            {users.length === 0 ? (
                                <Box textAlign="center" py={8}>
                                    <Text fontSize="lg">Not following anyone</Text>
                                    <Text fontSize="sm" color="gray.500" mt={2}>
                                        When you follow someone, they&apos;ll appear here.
                                    </Text>
                                </Box>
                            ) : (
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
                        </>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default SyncedFollowingList;
