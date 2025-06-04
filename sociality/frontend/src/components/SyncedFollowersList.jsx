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
import { fetchWithSession } from "../utils/api";

const SyncedFollowersList = ({ isOpen, onClose, username, onUserUpdate }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingIds, setProcessingIds] = useState({});
    const [followingMap, setFollowingMap] = useState({});

    const currentUser = useRecoilValue(userAtom);
    const setCurrentUser = useSetRecoilState(userAtom);
    const toast = useToast();

    // Fetch followers directly from the backend every time the modal opens
    useEffect(() => {
        const fetchFollowers = async () => {
            if (!isOpen) return;

            setIsLoading(true);
            setUsers([]); // Clear previous data

            try {
                console.log('Fetching followers data for:', username);

                // Get fresh user data
                const res = await fetch(`/api/users/profile/${username}`);
                const userData = await res.json();

                if (userData.error) {
                    console.error("Error fetching user data:", userData.error);
                    setUsers([]);
                    return;
                }

                // Log the followers data
                console.log('Followers data from backend:', userData.followers);

                // Set followers
                setUsers(userData.followers || []);

                // Get fresh current user data to ensure we have the latest following list
                if (currentUser) {
                    const currentUserRes = await fetch(`/api/users/profile/${currentUser.username}`);
                    const currentUserData = await currentUserRes.json();

                    if (!currentUserData.error) {
                        // Update the current user state
                        setCurrentUser(currentUserData);
                        localStorage.setItem('user-threads', JSON.stringify(currentUserData));

                        // Create following map
                        const newFollowingMap = {};
                        userData.followers.forEach(user => {
                            if (user && user._id) {
                                // Check if this user is in currentUser's following list
                                const isFollowing = currentUserData.following.some(followingId => {
                                    const id = typeof followingId === 'string' ? followingId : followingId._id;
                                    return id === user._id;
                                });
                                newFollowingMap[user._id] = isFollowing;
                                console.log(`Follower ${user.username}: ${isFollowing ? 'Following' : 'Not Following'}`);
                            }
                        });
                        setFollowingMap(newFollowingMap);
                    }
                }

                // Update the parent component
                if (onUserUpdate) {
                    onUserUpdate(userData);
                }
            } catch (error) {
                console.error("Error fetching followers:", error);
                setUsers([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFollowers();
    }, [isOpen, username, currentUser, onUserUpdate, setCurrentUser]);

    // Handle follow/unfollow action with direct backend update
    const handleFollowToggle = async (userId) => {
        if (processingIds[userId]) return; // Prevent multiple clicks

        // Set processing state
        setProcessingIds(prev => ({ ...prev, [userId]: true }));

        try {
            // Update UI immediately (optimistic update)
            const isCurrentlyFollowing = followingMap[userId];
            setFollowingMap(prev => ({
                ...prev,
                [userId]: !isCurrentlyFollowing
            }));

            console.log(`${isCurrentlyFollowing ? 'Unfollowing' : 'Following'} user:`, userId);

            // Make the API call
            const res = await fetchWithSession(`/api/users/follow/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (res.ok) {
                await res.json();
            } else {
                const errorData = await res.json().catch(() => ({ error: 'Failed to follow/unfollow user' }));
                // Revert UI if there's an error
                setFollowingMap(prev => ({
                    ...prev,
                    [userId]: isCurrentlyFollowing
                }));

                console.error('Error following/unfollowing user:', errorData.error);
                toast({
                    title: 'Error',
                    description: errorData.error || 'Failed to follow/unfollow user',
                    status: 'error',
                    duration: 3000,
                    isClosable: true
                });
                return;
            }

            console.log('Successfully followed/unfollowed user');

            // Get fresh user data after follow/unfollow
            const userRes = await fetch(`/api/users/profile/${currentUser.username}`);
            const userData = await userRes.json();

            if (!userData.error) {
                console.log('Updated user data after follow/unfollow:', {
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
                description: isCurrentlyFollowing ? 'User unfollowed' : 'User followed',
                status: 'success',
                duration: 3000,
                isClosable: true
            });
        } catch (error) {
            // Revert UI if there's an error
            const isCurrentlyFollowing = followingMap[userId];
            setFollowingMap(prev => ({
                ...prev,
                [userId]: isCurrentlyFollowing
            }));

            console.error('Error following/unfollowing user:', error);
            toast({
                title: 'Error',
                description: 'Failed to follow/unfollow user',
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
                <ModalHeader>Followers</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    {isLoading ? (
                        <Center py={8}>
                            <VStack>
                                <Spinner size="xl" color="blue.500" />
                                <Text mt={4}>Loading followers list...</Text>
                            </VStack>
                        </Center>
                    ) : (
                        <>
                            {users.length === 0 ? (
                                <Box textAlign="center" py={8}>
                                    <Text fontSize="lg">No followers yet</Text>
                                    <Text fontSize="sm" color="gray.500" mt={2}>
                                        When someone follows you, they&apos;ll appear here.
                                    </Text>
                                </Box>
                            ) : (
                                <VStack align="stretch" spacing={4} pb={4}>
                                    {users.map((user, index) => {
                                        if (!user || !user.username) {
                                            return null;
                                        }

                                        const isFollowing = followingMap[user._id] || false;

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
                                                            colorScheme={isFollowing ? "gray" : "blue"}
                                                            variant={isFollowing ? "outline" : "solid"}
                                                            onClick={() => handleFollowToggle(user._id)}
                                                            isLoading={processingIds[user._id]}
                                                        >
                                                            {isFollowing ? "Unfollow" : "Follow"}
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

export default SyncedFollowersList;
