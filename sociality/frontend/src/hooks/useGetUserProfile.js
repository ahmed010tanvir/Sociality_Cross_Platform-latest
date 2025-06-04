import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import useShowToast from "./useShowToast";
import { fetchWithSession } from "../utils/api";

const useGetUserProfile = () => {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);
	const { username } = useParams();
	const showToast = useShowToast();

	useEffect(() => {
		const getUser = async () => {
			try {
				const res = await fetchWithSession(`/api/users/profile/${username}`);
				if (res.ok) {
					const data = await res.json();
					if (data.isFrozen) {
						setUser(null);
						return;
					}
					setUser(data);
				} else {
					const errorData = await res.json().catch(() => ({ error: 'Failed to fetch user profile' }));
					showToast("Error", errorData.error || 'Failed to fetch user profile', "error");
				}
			} catch (error) {
				showToast("Error", error.message, "error");
			} finally {
				setLoading(false);
			}
		};
		getUser();
	}, [username, showToast]);

	return { loading, user };
};

export default useGetUserProfile;
