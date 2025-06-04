import { useState, useEffect, useCallback } from "react";
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

const UserListModal = ({ isOpen, onClose, title, username, type, onUserUpdate }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [followingMap, setFollowingMap] = useState({});
    const [processingIds, setProcessingIds] = useState({});
    const currentUser = useRecoilValue(userAtom);
    const setCurrentUser = useSetRecoilState(userAtom);
    const toast = useToast();

    // Fetch users when modal opens
    useEffect(() => {
        const fetchUsers = async () => {
            if (!isOpen || !username) return;

            setIsLoading(true);
            try {
                const res = await fetch(`/api/users/profile/${username}`);
                const userData = await res.json();

                if (userData.error) {
                    console.error("Error fetching user data:", userData.error);
                    setUsers([]);
                    return;
                }

                // Set users based on type (followers or following)
                let userList = [];
                if (type === "followers") {
                    userList = userData.followers || [];
                    setUsers(userList);
                } else if (type === "following") {
                    userList = userData.following || [];
                    setUsers(userList);
                }

                // Initialize following map
                if (currentUser && currentUser.following) {
                    const newFollowingMap = {};
                    userList.forEach(user => {
                        if (user && user._id) {
                            // Check if this user is in currentUser's following list
                            const isFollowing = currentUser.following.some(followingId => {
                                const id = typeof followingId === 'string' ? followingId : followingId._id;
                                return id === user._id;
                            });
                            newFollowingMap[user._id] = isFollowing;
                        }
                    });
                    setFollowingMap(newFollowingMap);
                }

                console.log(`Fetched ${type}:`, userList);
            } catch (error) {
                console.error("Error fetching users:", error);
                setUsers([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, [isOpen, username, type, currentUser]);

    // Handle follow/unfollow action
    const handleFollowUnfollow = useCallback(async (userId) => {
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

            // Update local following state
            setFollowingMap(prev => ({
                ...prev,
                [userId]: !prev[userId]
            }));

            // Update current user state
            if (currentUser) {
                const updatedFollowing = [...currentUser.following];

                if (!followingMap[userId]) {
                    // Follow: Add to following list
                    updatedFollowing.push(userId);
                } else {
                    // Unfollow: Remove from following list
                    const index = updatedFollowing.findIndex(id => {
                        const followingId = typeof id === 'string' ? id : id._id;
                        return followingId === userId;
                    });
                    if (index !== -1) {
                        updatedFollowing.splice(index, 1);
                    }
                }

                // Create updated user object
                const updatedCurrentUser = {
                    ...currentUser,
                    following: updatedFollowing
                };

                // Update the current user state
                setCurrentUser(updatedCurrentUser);

                // Call onUserUpdate to update the parent component
                if (onUserUpdate) {
                    onUserUpdate(updatedCurrentUser);
                }

                // If we're in the following list and unfollowing, remove the user from the list
                if (type === "following" && followingMap[userId]) {
                    // Remove the unfollowed user from the displayed list
                    setUsers(prevUsers => prevUsers.filter(user => user._id !== userId));
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
    }, [currentUser, followingMap, processingIds, setCurrentUser, toast, onUserUpdate, type]);

    // Check if users is an array and has items
    const hasUsers = Array.isArray(users) && users.length > 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
            <ModalOverlay />
            <ModalContent bg={"gray.dark"} color={"white"}>
                <ModalHeader>{title}</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    {isLoading && (
                        <Center py={8}>
                            <Spinner size="xl" color="blue.500" />
                        </Center>
                    )}

                    {!isLoading && !hasUsers && (
                        <Text textAlign="center" py={4}>
                            No {title.toLowerCase()} found
                        </Text>
                    )}

                    {!isLoading && hasUsers && (
                        <VStack align="stretch" spacing={4} pb={4}>
                            {users.map((user, index) => {
                                if (!user || !user.username) {
                                    return null;
                                }

                                return (
                                    <div key={user._id}>
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
                                                    onClick={() => handleFollowUnfollow(user._id)}
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

export default UserListModal;
