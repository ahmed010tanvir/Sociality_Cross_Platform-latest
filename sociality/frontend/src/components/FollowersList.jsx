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

const FollowersList = ({ isOpen, onClose, username, onUserUpdate }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingIds, setProcessingIds] = useState({});
    const [followingMap, setFollowingMap] = useState({});
    const currentUser = useRecoilValue(userAtom);
    const setCurrentUser = useSetRecoilState(userAtom);
    const toast = useToast();

    // Fetch followers when modal opens
    useEffect(() => {
        const fetchFollowers = async () => {
            if (!isOpen || !username) return;

            setIsLoading(true);
            try {
                const res = await fetchWithSession(`/api/users/profile/${username}`);
                if (res.ok) {
                    const userData = await res.json();

                    // Set followers
                    setUsers(userData.followers || []);
                    console.log("Fetched followers:", userData.followers);

                    // Initialize following map
                    if (currentUser) {
                        const newFollowingMap = {};
                        userData.followers.forEach(user => {
                            if (user && user._id) {
                                // Check if this user is in currentUser's following list
                                const isFollowing = Array.isArray(currentUser.following) && currentUser.following.some(followingId => {
                                    const id = typeof followingId === 'string' ? followingId : followingId?._id;
                                    return id === user._id;
                                });
                                newFollowingMap[user._id] = isFollowing;
                            }
                        });
                        setFollowingMap(newFollowingMap);
                    }
                } else {
                    const errorData = await res.json().catch(() => ({ error: 'Failed to fetch user data' }));
                    console.error("Error fetching user data:", errorData.error);
                    setUsers([]);
                    return;
                }
            } catch (error) {
                console.error("Error fetching followers:", error);
                setUsers([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFollowers();
    }, [isOpen, username, currentUser]);

    // Handle follow/unfollow action
    const handleFollowToggle = async (userId) => {
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
                const errorData = await res.json().catch(() => ({ error: 'Failed to follow/unfollow user' }));
                toast({
                    title: 'Error',
                    description: errorData.error || 'Failed to follow/unfollow user',
                    status: 'error',
                    duration: 3000,
                    isClosable: true
                });
                return;
            }

            // Update following map
            setFollowingMap(prev => ({
                ...prev,
                [userId]: !prev[userId]
            }));

            // Update current user state
            if (currentUser) {
                // Make sure following exists and is an array
                let updatedFollowing = Array.isArray(currentUser.following) ? [...currentUser.following] : [];

                if (!followingMap[userId]) {
                    // Follow: Add to following list
                    updatedFollowing.push(userId);
                } else {
                    // Unfollow: Remove from following list
                    updatedFollowing = updatedFollowing.filter(id => {
                        const followingId = typeof id === 'string' ? id : id?._id;
                        return followingId !== userId;
                    });
                }

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
                description: followingMap[userId] ? 'User unfollowed' : 'User followed',
                status: 'success',
                duration: 3000,
                isClosable: true
            });

            // Refresh the user profile to update counts
            try {
                const profileRes = await fetchWithSession(`/api/users/profile/${username}`);
                if (profileRes.ok) {
                    await profileRes.json();
                    console.log('Profile refreshed after follow/unfollow');
                    // Force a window reload to update all components
                    window.location.reload();
                } else {
                    console.error('Error refreshing profile');
                }
            } catch (error) {
                console.error('Error refreshing profile:', error);
            }

        } catch (error) {
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
                    {isLoading && (
                        <Center py={8}>
                            <Spinner size="xl" color="blue.500" />
                        </Center>
                    )}

                    {!isLoading && users.length === 0 && (
                        <Text textAlign="center" py={4}>
                            No followers found
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
                                                    colorScheme={followingMap[user._id] ? "gray" : "blue"}
                                                    variant={followingMap[user._id] ? "outline" : "solid"}
                                                    onClick={() => handleFollowToggle(user._id)}
                                                    isLoading={processingIds[user._id]}
                                                >
                                                    {followingMap[user._id] ? "Unfollow" : "Follow"}
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

export default FollowersList;
