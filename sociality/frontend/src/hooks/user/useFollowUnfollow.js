/**
 * Hook for following and unfollowing users
 */
import { useState } from "react";
import { useRecoilState } from "recoil";
import { userAtom } from "../../atoms";
import useShowToast from "../useShowToast";
import { userService } from "../../services/api";

const useFollowUnfollow = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [user, setUser] = useRecoilState(userAtom);
  const showToast = useShowToast();

  const followUser = async (userId) => {
    if (!user) {
      showToast("Error", "You must be logged in to follow users", "error");
      return false;
    }

    if (isUpdating) return false;

    setIsUpdating(true);
    try {
      await userService.followUser(userId);
      
      // Update the user atom with the new following
      if (user.following) {
        setUser({ ...user, following: [...user.following, userId] });
      } else {
        setUser({ ...user, following: [userId] });
      }
      
      return true;
    } catch (error) {
      showToast("Error", error.message, "error");
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const unfollowUser = async (userId) => {
    if (!user) {
      showToast("Error", "You must be logged in to unfollow users", "error");
      return false;
    }

    if (isUpdating) return false;

    setIsUpdating(true);
    try {
      await userService.unfollowUser(userId);
      
      // Update the user atom by removing the unfollowed user
      setUser({
        ...user,
        following: user.following.filter((id) => id !== userId),
      });
      
      return true;
    } catch (error) {
      showToast("Error", error.message, "error");
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  return { followUser, unfollowUser, isUpdating };
};

export default useFollowUnfollow;
