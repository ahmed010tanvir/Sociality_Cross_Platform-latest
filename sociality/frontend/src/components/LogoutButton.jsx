import { Button } from "@chakra-ui/button";
import { useSetRecoilState } from "recoil";
import { userAtom } from "../atoms";
import useShowToast from "../hooks/useShowToast";
import { FiLogOut } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const LogoutButton = () => {
	const setUser = useSetRecoilState(userAtom);
	const showToast = useShowToast();
	const navigate = useNavigate();

	const handleLogout = async () => {
		try {
			const res = await fetch("/api/users/logout", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			});
			const data = await res.json();

			if (data.error) {
				showToast("Error", data.error, "error");
				return;
			}

			localStorage.removeItem("user-threads");
			setUser(null);
			// Navigate to auth page after logout
			navigate("/auth");
			showToast("Success", "Logged out successfully", "success");
		} catch (error) {
			showToast("Error", error, "error");
		}
	};
	return (
		<Button position={"fixed"} top={"30px"} right={"30px"} size={"sm"} onClick={handleLogout}>
			<FiLogOut size={20} />
		</Button>
	);
};

export default LogoutButton;
