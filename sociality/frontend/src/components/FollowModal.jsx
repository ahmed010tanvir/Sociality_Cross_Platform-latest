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
    Button,
    useToast,
    Box,
    Spinner,
    Center,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { userAtom } from "../atoms";
import { fetchWithSession } from "../utils/api";
import styles from './FollowModal.module.css';

const FollowModal = ({ isOpen, onClose, username, onUserUpdate }) => {
    const [activeTab, setActiveTab] = useState(0); // 0 for followers, 1 for following
    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingIds, setProcessingIds] = useState({});
    const [followingMap, setFollowingMap] = useState({});
    const currentUser = useRecoilValue(userAtom);
    const setCurrentUser = useSetRecoilState(userAtom);
    const toast = useToast();

    // Fetch user data when modal opens
    useEffect(() => {
        const fetchUserData = async () => {
            if (!isOpen || !username) return;

            setIsLoading(true);

            try {
                // Fetch the user's profile data
                const res = await fetch(`/api/users/profile/${username}`);
                const userData = await res.json();

                if (!res.ok) {
                    throw new Error(userData.error || 'Failed to fetch user data');
                }

                // Update followers and following lists
                if (Array.isArray(userData.followers)) {
                    setFollowers(userData.followers);
                }

                if (Array.isArray(userData.following)) {
                    setFollowing(userData.following);
                }

                // Create a map of users the current user is following for easy lookup
                if (currentUser && Array.isArray(currentUser.following)) {
                    const followMap = {};
                    currentUser.following.forEach(user => {
                        followMap[user._id || user] = true;
                    });
                    setFollowingMap(followMap);
                }

                // If this is the current user, update the global state
                if (currentUser && currentUser.username === username) {
                    setCurrentUser(userData);
                    localStorage.setItem('user-threads', JSON.stringify(userData));
                }

                // Update the parent component
                if (onUserUpdate) {
                    onUserUpdate(userData);
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                setFollowers([]);
                setFollowing([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserData();

        // Set up an interval to refresh the data every 10 seconds while the modal is open
        const intervalId = setInterval(() => {
            if (isOpen) {
                console.log('Auto-refreshing user data');
                fetchUserData();
            }
        }, 10000);

        // Clean up the interval when the component unmounts or the modal closes
        return () => clearInterval(intervalId);
    }, [isOpen, username, currentUser, onUserUpdate, setCurrentUser]);

    // Handle follow/unfollow action for followers list
    const handleFollowToggle = async (userId) => {
        if (processingIds[userId]) return; // Prevent multiple clicks

        // Set processing state
        setProcessingIds(prev => ({ ...prev, [userId]: true }));

        // Get current following state
        const isCurrentlyFollowing = followingMap[userId] || false;

        // Update UI immediately (optimistic update)
        setFollowingMap(prev => ({
            ...prev,
            [userId]: !isCurrentlyFollowing
        }));

        try {
            // Make the API call to follow/unfollow
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

            // The API doesn't return updated user data, so we need to fetch it
            // Fetch current user data to get updated following list
            const currentUserRes = await fetch(`/api/users/profile/${currentUser.username}`);
            const currentUserData = await currentUserRes.json();

            if (!currentUserRes.ok) {
                console.error("Error fetching current user data:", currentUserData.error);
                toast({
                    title: 'Error',
                    description: 'Failed to update following information',
                    status: 'error',
                    duration: 3000,
                    isClosable: true
                });
                return;
            }

            // Update current user state with fresh data from the server
            setCurrentUser(currentUserData);
            localStorage.setItem('user-threads', JSON.stringify(currentUserData));

            // Update the following map with fresh data
            if (Array.isArray(currentUserData.following)) {
                const newFollowingMap = {...followingMap};
                followers.forEach(user => {
                    if (user && user._id) {
                        // Check if this user is in currentUser's following list
                        const isFollowing = currentUserData.following.some(followingId => {
                            const id = typeof followingId === 'string' ? followingId : followingId._id;
                            return id === user._id;
                        });
                        newFollowingMap[user._id] = isFollowing;
                    }
                });
                setFollowingMap(newFollowingMap);
            }

            // Fetch the profile being viewed to get updated follower/following lists
            const profileRes = await fetch(`/api/users/profile/${username}`);
            const profileData = await profileRes.json();

            if (!profileRes.ok) {
                console.error("Error fetching profile data:", profileData.error);
                return;
            }

            // Update the followers and following lists
            if (Array.isArray(profileData.followers)) {
                setFollowers(profileData.followers);
            }

            if (Array.isArray(profileData.following)) {
                setFollowing(profileData.following);
            }

            // Update parent component immediately with the updated user data
            if (onUserUpdate) {
                console.log('Updating parent with new profile data:', {
                    followers: profileData.followers?.length || 0,
                    following: profileData.following?.length || 0
                });
                onUserUpdate(profileData);
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
            setFollowingMap(prev => ({
                ...prev,
                [userId]: isCurrentlyFollowing
            }));

            toast({
                title: 'Error',
                description: 'Failed to follow/unfollow user',
                status: 'error',
                duration: 3000,
                isClosable: true
            });
            console.error('Error in handleFollowToggle:', error);
        } finally {
            // Clear processing state
            setProcessingIds(prev => ({ ...prev, [userId]: false }));
        }
    };

    // Handle unfollow for following list
    const handleUnfollow = async (userId) => {
        if (processingIds[userId]) return; // Prevent multiple clicks

        // Set processing state
        setProcessingIds(prev => ({ ...prev, [userId]: true }));

        try {
            // Remove the user from the list immediately for better UX
            setFollowing(prev => prev.filter(user => user._id !== userId));

            // Make API call to unfollow
            const res = await fetch(`/api/users/follow/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await res.json();

            if (data.error) {
                toast({
                    title: 'Error',
                    description: data.error,
                    status: 'error',
                    duration: 3000,
                    isClosable: true
                });

                // Reload the following list to restore the state
                const profileRes = await fetch(`/api/users/profile/${username}`);
                const profileData = await profileRes.json();
                if (!profileRes.ok) {
                    console.error("Error fetching profile data:", profileData.error);
                    return;
                }

                if (Array.isArray(profileData.following)) {
                    setFollowing(profileData.following);
                }

                return;
            }

            // The API doesn't return updated user data, so we need to fetch it
            // Fetch current user data to get updated following list
            const currentUserRes = await fetch(`/api/users/profile/${currentUser.username}`);
            const currentUserData = await currentUserRes.json();

            if (!currentUserRes.ok) {
                console.error("Error fetching current user data:", currentUserData.error);
                return;
            }

            // Update current user state with fresh data from the server
            setCurrentUser(currentUserData);
            localStorage.setItem('user-threads', JSON.stringify(currentUserData));

            // Fetch the profile being viewed to get updated follower/following lists
            const profileRes = await fetch(`/api/users/profile/${username}`);
            const profileData = await profileRes.json();

            if (!profileRes.ok) {
                console.error("Error fetching profile data:", profileData.error);
                return;
            }

            // Update the followers and following lists (though we already updated following)
            if (Array.isArray(profileData.followers)) {
                setFollowers(profileData.followers);
            }

            // Update parent component immediately with the updated user data
            if (onUserUpdate) {
                console.log('Updating parent with new profile data after unfollow:', {
                    followers: profileData.followers?.length || 0,
                    following: profileData.following?.length || 0
                });
                onUserUpdate(profileData);
            }

            // Show success message
            toast({
                title: 'Success',
                description: 'User unfollowed',
                status: 'success',
                duration: 3000,
                isClosable: true
            });
        } catch (error) {
            console.error('Error unfollowing user:', error);
            toast({
                title: 'Error',
                description: 'Failed to unfollow user',
                status: 'error',
                duration: 3000,
                isClosable: true
            });

            // Reload the following list to restore the state
            const profileRes = await fetch(`/api/users/profile/${username}`);
            const profileData = await profileRes.json();
            if (!profileRes.ok) {
                console.error("Error fetching profile data:", profileData.error);
                return;
            }

            if (Array.isArray(profileData.following)) {
                setFollowing(profileData.following);
            }
        } finally {
            // Clear processing state
            setProcessingIds(prev => ({ ...prev, [userId]: false }));
        }
    };

    // Render followers list
    const renderFollowersList = () => {
        if (isLoading) {
            return (
                <Center py={8}>
                    <VStack>
                        <Spinner size="xl" color="blue.500" />
                        <Text mt={4}>Loading followers...</Text>
                    </VStack>
                </Center>
            );
        }

        if (!followers.length) {
            return (
                <Box className={styles.emptyState}>
                    <Text className={styles.emptyStateText}>No followers yet</Text>
                    <Text className={styles.emptyStateSubtext}>
                        When people follow you, they&apos;ll appear here.
                    </Text>
                </Box>
            );
        }

        return (
            <VStack align="stretch" spacing={4} pb={4}>
                {followers.map((user, index) => {
                    if (!user || !user.username) {
                        return null;
                    }
                    // Check if the current user is following this follower
                    const isFollowing = followingMap[user._id] || false;

                    return (
                        <div key={user._id || index}>
                            <div className={styles.userItem}>
                                <div className={styles.userInfo}>
                                    <Avatar
                                        size="md"
                                        name={user.username || 'User'}
                                        src={user.profilePic}
                                    />
                                    <div className={styles.userDetails}>
                                        <RouterLink
                                            to={`/${user.username}`}
                                            className={styles.username}
                                            onClick={onClose}
                                        >
                                            {user.username || 'Unknown User'}
                                        </RouterLink>
                                        {user.name && (
                                            <Text className={styles.name}>
                                                {user.name}
                                            </Text>
                                        )}
                                    </div>
                                </div>

                                {currentUser && currentUser._id !== user._id && (
                                    <Button
                                        size="sm"
                                        bg={isFollowing ? "transparent" : "rgba(0, 204, 133, 0.2)"}
                                        color="white"
                                        borderWidth="1px"
                                        borderColor={isFollowing ? "gray.600" : "rgba(0, 204, 133, 0.5)"}
                                        _hover={{
                                            bg: isFollowing ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 204, 133, 0.3)",
                                            transform: "translateY(-2px)",
                                            borderColor: isFollowing ? "gray.400" : "rgba(0, 204, 133, 0.7)"
                                        }}
                                        transition="all 0.2s"
                                        borderRadius="md" // Changed from "full" to "md" for rounded rectangle
                                        fontWeight="medium"
                                        onClick={() => handleFollowToggle(user._id)}
                                        isLoading={processingIds[user._id]}
                                        boxShadow="0 2px 6px rgba(0, 0, 0, 0.1)"
                                        px={4}
                                        py={3}
                                        _active={{
                                            transform: "scale(0.98)",
                                            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
                                        }}
                                    >
                                        {isFollowing ? "Unfollow" : "Follow"}
                                    </Button>
                                )}
                            </div>
                            {index < followers.length - 1 && <div className={styles.divider} />}
                        </div>
                    );
                })}
            </VStack>
        );
    };

    // Render following list
    const renderFollowingList = () => {
        if (isLoading) {
            return (
                <Center py={8}>
                    <VStack>
                        <Spinner size="xl" color="blue.500" />
                        <Text mt={4}>Loading following...</Text>
                    </VStack>
                </Center>
            );
        }

        if (!following.length) {
            return (
                <Box className={styles.emptyState}>
                    <Text className={styles.emptyStateText}>Not following anyone</Text>
                    <Text className={styles.emptyStateSubtext}>
                        When you follow someone, they&apos;ll appear here.
                    </Text>
                </Box>
            );
        }

        return (
            <VStack align="stretch" spacing={4} pb={4}>
                {following.map((user, index) => {
                    if (!user || !user.username) {
                        return null;
                    }
                    return (
                        <div key={user._id || index}>
                            <div className={styles.userItem}>
                                <div className={styles.userInfo}>
                                    <Avatar
                                        size="md"
                                        name={user.username || 'User'}
                                        src={user.profilePic}
                                    />
                                    <div className={styles.userDetails}>
                                        <RouterLink
                                            to={`/${user.username}`}
                                            className={styles.username}
                                            onClick={onClose}
                                        >
                                            {user.username || 'Unknown User'}
                                        </RouterLink>
                                        {user.name && (
                                            <Text className={styles.name}>
                                                {user.name}
                                            </Text>
                                        )}
                                    </div>
                                </div>

                                {currentUser && currentUser._id !== user._id && (
                                    <Button
                                        size="sm"
                                        bg="transparent"
                                        color="white"
                                        borderWidth="1px"
                                        borderColor="gray.600"
                                        _hover={{
                                            bg: "rgba(255, 255, 255, 0.1)",
                                            transform: "translateY(-2px)",
                                            borderColor: "gray.400"
                                        }}
                                        transition="all 0.2s"
                                        borderRadius="md" // Changed from "full" to "md" for rounded rectangle
                                        fontWeight="medium"
                                        onClick={() => handleUnfollow(user._id)}
                                        isLoading={processingIds[user._id]}
                                        boxShadow="0 2px 6px rgba(0, 0, 0, 0.1)"
                                        px={4}
                                        py={3}
                                        _active={{
                                            transform: "scale(0.98)",
                                            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
                                        }}
                                    >
                                        Unfollow
                                    </Button>
                                )}
                            </div>
                            {index < following.length - 1 && <div className={styles.divider} />}
                        </div>
                    );
                })}
            </VStack>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
            <ModalOverlay />
            <ModalContent
                bg="#101010"
                color="white"
                borderWidth="1px"
                borderColor="gray.700"
                boxShadow="0 4px 12px rgba(0, 0, 0, 0.2)"
                className="glass-card"
                borderRadius="xl"
            >
                <ModalHeader className={styles.modalHeader}>
                    <div className={styles.tabList}>
                        <div
                            className={`${styles.tab} ${activeTab === 0 ? styles.tabSelected : ''}`}
                            onClick={() => setActiveTab(0)}
                        >
                            Followers
                        </div>
                        <div
                            className={`${styles.tab} ${activeTab === 1 ? styles.tabSelected : ''}`}
                            onClick={() => setActiveTab(1)}
                        >
                            Following
                        </div>
                    </div>
                </ModalHeader>
                <ModalCloseButton
                    top={3}
                    color="gray.400"
                    _hover={{
                        bg: "rgba(0, 204, 133, 0.1)",
                        color: "white"
                    }}
                    borderRadius="full"
                />
                <ModalBody p={4}>
                    {activeTab === 0 ? renderFollowersList() : renderFollowingList()}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default FollowModal;
