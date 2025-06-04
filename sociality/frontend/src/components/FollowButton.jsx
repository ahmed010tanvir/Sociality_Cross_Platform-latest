import { useState, useEffect } from "react";
import { Button, useToast } from "@chakra-ui/react";
import { useRecoilState } from "recoil";
import { userAtom } from "../atoms";
import { fetchWithSession } from "../utils/api";

const FollowButton = ({ userId, initialIsFollowing, size = "sm", onFollowToggle, onUnfollowComplete }) => {
    // Use initialIsFollowing as the initial state, but also update when the prop changes
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [isLoading, setIsLoading] = useState(false);
    const [user, setUser] = useRecoilState(userAtom);
    const toast = useToast();

    // Update the state when initialIsFollowing changes
    useEffect(() => {
        console.log('FollowButton - initialIsFollowing:', initialIsFollowing, 'userId:', userId);
        setIsFollowing(initialIsFollowing);
    }, [initialIsFollowing, userId]);

    // Double-check against user's following list for correct state
    useEffect(() => {
        if (user && userId) {
            const isActuallyFollowing = user.following?.some(following => {
                const followingId = typeof following === 'string' ? following : following?._id;
                return followingId === userId;
            }) || false;

            if (isActuallyFollowing !== isFollowing) {
                console.log('Correcting follow state:', { was: isFollowing, now: isActuallyFollowing, userId });
                setIsFollowing(isActuallyFollowing);
            }
        }
    }, [user, userId, isFollowing]);

    const handleFollowUnfollow = async () => {
        if (!user) return;

        setIsLoading(true);

        // Store the current state before changing it
        const wasFollowing = isFollowing;

        try {

            // Optimistic update - update UI immediately
            setIsFollowing(!isFollowing);

            // Update following list in user state
            let updatedFollowing = [...(user.following || [])];

            if (!isFollowing) {
                // Follow: Add to following list
                updatedFollowing.push(userId);
                console.log('Added user to following list:', userId);
            } else {
                // Unfollow: Remove from following list
                updatedFollowing = updatedFollowing.filter(id => {
                    const followingId = typeof id === 'string' ? id : id?._id;
                    return followingId !== userId;
                });
                console.log('Removed user from following list:', userId);
            }

            // Update user state with the new following list
            const updatedUser = {
                ...user,
                following: updatedFollowing
            };

            // Log the updated following count
            console.log('Updated following count:', updatedFollowing.length);
            console.log('Updated following list:', updatedFollowing);

            // Update the user state in Recoil
            setUser(updatedUser);

            // Update localStorage to persist changes
            localStorage.setItem('user-threads', JSON.stringify(updatedUser));

            // Log the updated user state for debugging
            console.log('Updated user state:', updatedUser);

            // Call API
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
                // Revert optimistic update if there's an error
                setIsFollowing(wasFollowing);

                toast({
                    title: 'Error',
                    description: errorData.error || 'Failed to follow/unfollow user',
                    status: 'error',
                    duration: 3000,
                    isClosable: true
                });

                // Revert user state
                setUser(user);
                localStorage.setItem('user-threads', JSON.stringify(user));
                return;
            }

            // Fetch updated user data to get accurate counts
            try {
                const userRes = await fetchWithSession(`/api/users/profile/${user.username}`);
                if (userRes.ok) {
                    const userData = await userRes.json();

                    // Update the current user state with the latest data
                    setUser(userData);

                    // Update localStorage
                    localStorage.setItem('user-threads', JSON.stringify(userData));

                    console.log('Updated user data after follow/unfollow:', {
                        followers: userData.followers?.length || 0,
                        following: userData.following?.length || 0
                    });

                    // Notify parent component with updated user data
                    if (onFollowToggle) {
                        onFollowToggle(!isFollowing, userId, userData);
                    }

                    // If we're unfollowing and there's an onUnfollowComplete callback, call it
                    if (isFollowing && onUnfollowComplete) {
                        onUnfollowComplete(userId);
                    }
                } else {
                    console.error('Error fetching updated user data');
                }
            } catch (error) {
                console.error('Error fetching updated user data:', error);
            }

        } catch (error) {
            // Revert optimistic update if there's an error
            setIsFollowing(wasFollowing);

            toast({
                title: 'Error',
                description: 'Failed to follow/unfollow user',
                status: 'error',
                duration: 3000,
                isClosable: true
            });

            // Revert user state
            setUser(user);
            localStorage.setItem('user-threads', JSON.stringify(user));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button
            size={size}
            bg={isFollowing ? "transparent" : "rgba(0, 204, 133, 0.2)"}
            color={isFollowing ? "white" : "white"}
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
            onClick={handleFollowUnfollow}
            isLoading={isLoading}
            boxShadow="0 2px 6px rgba(0, 0, 0, 0.1)"
            px={5}
            py={size === "sm" ? 4 : 5}
            _active={{
                transform: "scale(0.98)",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
            }}
        >
            {isFollowing ? "Unfollow" : "Follow"}
        </Button>
    );
};

export default FollowButton;
