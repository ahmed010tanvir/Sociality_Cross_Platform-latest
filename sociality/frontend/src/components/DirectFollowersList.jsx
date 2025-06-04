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

const DirectFollowersList = ({ isOpen, onClose, username }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingIds, setProcessingIds] = useState({});
    const [followingMap, setFollowingMap] = useState({});
    const currentUser = useRecoilValue(userAtom);
    const setCurrentUser = useSetRecoilState(userAtom);
    const toast = useToast();

    // Fetch followers directly from the API
    useEffect(() => {
        const fetchFollowers = async () => {
            if (!isOpen || !username) return;

            setIsLoading(true);

            try {
                // Get fresh user data
                const res = await fetchWithSession(`/api/users/profile/${username}`);
                if (res.ok) {
                    const userData = await res.json();

                    // Set followers
                    const followers = userData.followers || [];
                    setUsers(followers);
                    console.log("Fresh followers data:", followers);

                    // Initialize following map
                    if (currentUser) {
                        // Get fresh current user data to ensure we have the latest following list
                        const currentUserRes = await fetchWithSession(`/api/users/profile/${currentUser.username}`);
                        if (currentUserRes.ok) {
                            const currentUserData = await currentUserRes.json();
                        // Update the current user state with the latest data
                        setCurrentUser(currentUserData);

                        // Update localStorage
                        localStorage.setItem('user-threads', JSON.stringify(currentUserData));

                        // Create following map
                        const newFollowingMap = {};
                        followers.forEach(user => {
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
                        } else {
                            console.error("Error fetching current user data");
                        }
                    }
                } else {
                    const errorData = await res.json().catch(() => ({ error: 'Failed to fetch user data' }));
                    console.error("Error fetching user data:", errorData.error);
                    setUsers([]);
                }
            } catch (error) {
                console.error("Error fetching followers:", error);
                setUsers([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFollowers();
    }, [isOpen, username, currentUser, setCurrentUser]);

    // Handle follow/unfollow action
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

                toast({
                    title: 'Error',
                    description: errorData.error || 'Failed to follow/unfollow user',
                    status: 'error',
                    duration: 3000,
                    isClosable: true
                });
                return;
            }

            // Update current user state
            if (currentUser) {
                let updatedFollowing = [...currentUser.following];

                if (!isCurrentlyFollowing) {
                    // Follow: Add to following list
                    updatedFollowing.push(userId);
                } else {
                    // Unfollow: Remove from following list
                    updatedFollowing = updatedFollowing.filter(id => {
                        const followingId = typeof id === 'string' ? id : id._id;
                        return followingId !== userId;
                    });
                }

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
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default DirectFollowersList;
