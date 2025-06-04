import { useState, useEffect } from "react";
import useShowToast from "./useShowToast";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { userAtom } from "../atoms";
import { fetchWithSession } from "../utils/api";
import { useParams } from "react-router-dom";

const useFollowUnfollow = (user, onFollowToggle = null) => {
	const currentUser = useRecoilValue(userAtom);
	const setCurrentUser = useSetRecoilState(userAtom);
	const { username } = useParams();
	// Check if current user's following list includes this user's ID
	const [following, setFollowing] = useState(
		currentUser?.following?.some(followingUser => {
			// Handle both string IDs and populated user objects
			const followingId = typeof followingUser === 'string' ? followingUser : followingUser?._id;
			return followingId === user?._id;
		}) || false
	);

	// Update the following state if currentUser or user changes
	useEffect(() => {
		if (currentUser && user) {
			const isFollowing = currentUser.following?.some(followingUser => {
				const followingId = typeof followingUser === 'string' ? followingUser : followingUser?._id;
				return followingId === user._id;
			}) || false;

			setFollowing(isFollowing);
		}
	}, [currentUser, user]);

	const [updating, setUpdating] = useState(false);
	const showToast = useShowToast();

	const handleFollowUnfollow = async () => {
		if (!currentUser) {
			showToast("Error", "Please login to follow", "error");
			return;
		}
		if (updating) return;

		setUpdating(true);
		try {
			const res = await fetchWithSession(`/api/users/follow/${user._id}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			});
			if (res.ok) {
				const data = await res.json();
			} else {
				const errorData = await res.json().catch(() => ({ error: 'Failed to follow/unfollow user' }));
				showToast("Error", errorData.error || 'Failed to follow/unfollow user', "error");
				return;
			}

			// Update local state for immediate UI feedback
			if (following) {
				showToast("Success", `Unfollowed ${user.name}`, "success");
				// Remove current user from followers
				if (Array.isArray(user.followers)) {
					user.followers = user.followers.filter(follower => {
						const followerId = typeof follower === 'string' ? follower : follower?._id;
						return followerId !== currentUser?._id;
					});
				}

				// Update current user's following list
				if (currentUser && Array.isArray(currentUser.following)) {
					const updatedFollowing = currentUser.following.filter(followingUser => {
						const followingId = typeof followingUser === 'string' ? followingUser : followingUser?._id;
						return followingId !== user._id;
					});

					const updatedUser = { ...currentUser, following: updatedFollowing };
					setCurrentUser(updatedUser);
					localStorage.setItem("user-threads", JSON.stringify(updatedUser));
				}
			} else {
				showToast("Success", `Followed ${user.name}`, "success");
				// Add current user to followers by fetching complete profile
				if (Array.isArray(user.followers)) {
					const fetchFollowerProfile = async () => {
						try {
							const res = await fetchWithSession(`/api/users/profile/${currentUser.username}`);
							if (res.ok) {
								const followerProfile = await res.json();
								user.followers.push(followerProfile);
							} else {
								console.error("Error fetching follower profile");
								// Fallback to minimal user info if profile fetch fails
								const followerToAdd = {
									_id: currentUser._id,
									username: currentUser.username,
									name: currentUser.name,
									profilePic: currentUser.profilePic
								};
								user.followers.push(followerToAdd);
							}
						} catch (error) {
							console.error("Error fetching follower profile:", error);
							// Fallback to minimal user info on fetch error
							const followerToAdd = {
								_id: currentUser._id,
								username: currentUser.username,
								name: currentUser.name,
								profilePic: currentUser.profilePic
							};
							user.followers.push(followerToAdd);
						}
					};
					await fetchFollowerProfile();
				}

				// Update current user's following list
				if (currentUser) {
					const followingToAdd = {
						_id: user._id,
						username: user.username,
						name: user.name,
						profilePic: user.profilePic
					};

					const updatedFollowing = Array.isArray(currentUser.following)
						? [...currentUser.following, followingToAdd]
						: [followingToAdd];

					const updatedUser = { ...currentUser, following: updatedFollowing };
					setCurrentUser(updatedUser);
					localStorage.setItem("user-threads", JSON.stringify(updatedUser));
				}
			}

			setFollowing(!following);

			// Call the callback function if provided
			if (onFollowToggle) {
				// Refresh the user profile data
				const refreshUserProfile = async () => {
					try {
						const res = await fetchWithSession(`/api/users/profile/${username || user.username}`);
						if (res.ok) {
							const updatedUserData = await res.json();
							onFollowToggle(updatedUserData);
						} else {
							throw new Error("Failed to refresh user profile");
						}
					} catch (error) {
						console.error("Error refreshing user profile:", error);
					}
				};
				refreshUserProfile();
			}
		} catch (error) {
			showToast("Error", error.message || "An error occurred", "error");
		} finally {
			setUpdating(false);
		}
	};

	return { handleFollowUnfollow, updating, following };
};

export default useFollowUnfollow;
