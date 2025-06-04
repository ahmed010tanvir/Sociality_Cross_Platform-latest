/**
 * Hook for handling user logout
 */
import { useSetRecoilState } from "recoil";
import { userAtom } from "../../atoms";
import useShowToast from "../useShowToast";
import { userService } from "../../services/api";
import { useNavigate } from "react-router-dom";

const useLogout = () => {
  const setUser = useSetRecoilState(userAtom);
  const showToast = useShowToast();
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await userService.logout();
      localStorage.removeItem("user-threads");
      setUser(null);
      navigate("/auth");
    } catch (error) {
      showToast("Error", error.message, "error");
    }
  };

  return logout;
};

export default useLogout;
