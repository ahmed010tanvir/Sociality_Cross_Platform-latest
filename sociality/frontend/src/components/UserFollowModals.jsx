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
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { useRecoilValue } from "recoil";
import { userAtom } from "../atoms";
import FollowButton from "./FollowButton";
import { fetchWithSession } from "../utils/api";

const UserFollowModals = ({ isFollowersOpen, isFollowingOpen, onFollowersClose, onFollowingClose, username, onUserUpdate }) => {
    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [isLoadingFollowers, setIsLoadingFollowers] = useState(true);
    const [isLoadingFollowing, setIsLoadingFollowing] = useState(true);
    const currentUser = useRecoilValue(userAtom);

    // Fetch user data when modals open
    useEffect(() => {
        // Always set loading state when the modals open
        if (isFollowersOpen) {
            setIsLoadingFollowers(true);
            // Clear previous data to avoid showing stale data
            setFollowers([]);
        }

        if (isFollowingOpen) {
            setIsLoadingFollowing(true);
            // Clear previous data to avoid showing stale data
            setFollowing([]);
        }

        if (!isFollowersOpen && !isFollowingOpen) {
            return;
        }

        // Use the fetchUserData function we defined
        fetchUserData();
    }, [isFollowersOpen, isFollowingOpen, currentUser, fetchUserData]); // Added currentUser and fetchUserData to dependencies

    // Handle follow/unfollow updates for followers
    const handleFollowersFollowToggle = (isFollowing, userId, userData) => {
        // For followers list, we don't remove the user, just update the button state
        console.log(`User ${userId} ${isFollowing ? 'followed' : 'unfollowed'} in followers list`);

        // Update the parent component with the new user data
        if (userData && onUserUpdate) {
            onUserUpdate(userData);
        }

        // Force refresh the lists to update button states
        fetchUserData();
    };

    // Handle follow/unfollow updates for following
    const handleFollowingFollowToggle = async (isFollowing, userId, userData) => {
        // If unfollowing, remove from following list immediately
        if (!isFollowing) {
            console.log('Removing user from following list in modal:', userId);

            // Remove the user from the following list immediately for better UX
            setFollowing(prev => {
                const filtered = prev.filter(user => user._id !== userId);
                console.log('Filtered following list:', filtered.map(u => u.username));
                return filtered;
            });

            // Close the modal after a short delay if the list becomes empty
            // This provides better UX when unfollowing the last user
            setTimeout(() => {
                setFollowing(prev => {
                    if (prev.length === 0) {
                        onFollowingClose();
                    }
                    return prev;
                });
            }, 300);

            // Make a direct API call to ensure the backend is updated
            try {
                const res = await fetchWithSession(`/api/users/follow/${userId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (res.ok) {
                    await res.json();
                    console.log('Successfully unfollowed user in backend');
                } else {
                    const errorData = await res.json().catch(() => ({ error: 'Failed to unfollow user' }));
                    console.error('Error unfollowing user:', errorData.error);
                }
            } catch (error) {
                console.error('Error making unfollow API call:', error);
            }
        }

        // Update the parent component with the new user data
        if (userData && onUserUpdate) {
            console.log('Updating parent with new user data after follow/unfollow');
            onUserUpdate(userData);
        }

        // Force a refresh of the data to ensure we have the latest state
        fetchUserData();
    };

    // Separate the fetch function so we can call it directly
    const fetchUserData = useCallback(async () => {
        if (!username) return;

        try {
            console.log('Fetching fresh user data for modals');
            const res = await fetchWithSession(`/api/users/profile/${username}`);
            if (res.ok) {
                const userData = await res.json();

                console.log('Received fresh user data:', {
                    followers: userData.followers?.length || 0,
                    following: userData.following?.length || 0
                });

                if (isFollowersOpen) {
                // For followers, we need to get the full user objects
                // This ensures we have all the data needed for the UI
                const followers = userData.followers || [];
                setFollowers(followers);
                setIsLoadingFollowers(false);
                console.log('Updated followers list with', followers.length, 'users');

                // Log the follow status of each follower for debugging
                followers.forEach(follower => {
                    const isFollowing = currentUser?.following?.some(followingId => {
                        const id = typeof followingId === 'string' ? followingId : followingId?._id;
                        return id === follower._id;
                    }) || false;
                    console.log(`Follower ${follower.username} (${follower._id}): ${isFollowing ? 'Following' : 'Not Following'}`);
                });
            }

            if (isFollowingOpen) {
                // For following, we need to get the full user objects
                const following = userData.following || [];
                setFollowing(following);
                setIsLoadingFollowing(false);
                console.log('Updated following list with', following.length, 'users');

                // Log the users you're following for debugging
                following.forEach(followedUser => {
                    console.log(`Following: ${followedUser.username} (${followedUser._id})`);
                });
            }

                // Update the parent component with the new user data
                if (onUserUpdate) {
                    onUserUpdate(userData);
                }
            } else {
                const errorData = await res.json().catch(() => ({ error: 'Failed to fetch user data' }));
                console.error("Error fetching user data:", errorData.error);
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    }, [username, isFollowersOpen, isFollowingOpen, currentUser, onUserUpdate]);

    // Render a user list
    const renderUserList = (users, isLoading, handleFollowToggle, title) => {
        if (isLoading) {
            return (
                <Center py={8}>
                    <Spinner size="xl" color="blue.500" />
                </Center>
            );
        }

        if (users.length === 0) {
            return (
                <Text textAlign="center" py={4}>
                    No {title.toLowerCase()} found
                </Text>
            );
        }

        // Sort the users so that users you don't follow appear first (Instagram-like behavior)
        const sortedUsers = [...users].sort((a, b) => {
            const aIsFollowing = currentUser?.following?.some(followingId => {
                const id = typeof followingId === 'string' ? followingId : followingId?._id;
                return id === a._id;
            }) || false;

            const bIsFollowing = currentUser?.following?.some(followingId => {
                const id = typeof followingId === 'string' ? followingId : followingId?._id;
                return id === b._id;
            }) || false;

            // Users you don't follow come first (Instagram-like behavior)
            if (aIsFollowing && !bIsFollowing) return 1;
            if (!aIsFollowing && bIsFollowing) return -1;
            return 0;
        });

        return (
            <VStack align="stretch" spacing={4} pb={4}>
                {sortedUsers.map((user, index) => {
                    if (!user || !user.username) {
                        return null;
                    }

                    // Check if current user is following this user
                    const isFollowing = currentUser?.following?.some(followingId => {
                        const id = typeof followingId === 'string' ? followingId : followingId?._id;
                        return id === user._id;
                    }) || false;

                    console.log(`Rendering user ${user.username} (${user._id}) in ${title} list, isFollowing: ${isFollowing}`);

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
                                            onClick={title === "Followers" ? onFollowersClose : onFollowingClose}
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
                                    <FollowButton
                                        userId={user._id}
                                        initialIsFollowing={isFollowing}
                                        onFollowToggle={handleFollowToggle}
                                        onUnfollowComplete={title === "Following" ?
                                            (userId) => setFollowing(prev => prev.filter(u => u._id !== userId)) :
                                            undefined}
                                    />
                                )}
                            </HStack>
                            {index < sortedUsers.length - 1 && <Divider mt={2} />}
                        </div>
                    );
                })}
            </VStack>
        );
    };

    return (
        <>
            {/* Followers Modal - Using key to force re-render when opened */}
            <Modal key={`followers-${isFollowersOpen}`} isOpen={isFollowersOpen} onClose={onFollowersClose} isCentered size="md">
                <ModalOverlay />
                <ModalContent bg={"gray.dark"} color={"white"}>
                    <ModalHeader>Followers</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        {renderUserList(followers, isLoadingFollowers, handleFollowersFollowToggle, "Followers")}
                    </ModalBody>
                </ModalContent>
            </Modal>

            {/* Following Modal - Using key to force re-render when opened */}
            <Modal key={`following-${isFollowingOpen}`} isOpen={isFollowingOpen} onClose={onFollowingClose} isCentered size="md">
                <ModalOverlay />
                <ModalContent bg={"gray.dark"} color={"white"}>
                    <ModalHeader>Following</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        {renderUserList(following, isLoadingFollowing, handleFollowingFollowToggle, "Following")}
                    </ModalBody>
                </ModalContent>
            </Modal>
        </>
    );
};

export default UserFollowModals;
