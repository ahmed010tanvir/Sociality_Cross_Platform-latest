/**
 * Hook for fetching user profile data
 */
import { useState, useEffect } from "react";
import useShowToast from "../useShowToast";
import { userService } from "../../services/api";

const useGetUserProfile = (username) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const showToast = useShowToast();

  useEffect(() => {
    const getUser = async () => {
      setLoading(true);
      try {
        const data = await userService.getProfile(username);
        setUser(data);
      } catch (error) {
        showToast("Error", error.message, "error");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getUser();
  }, [username, showToast]);

  return { user, loading };
};

export default useGetUserProfile;
