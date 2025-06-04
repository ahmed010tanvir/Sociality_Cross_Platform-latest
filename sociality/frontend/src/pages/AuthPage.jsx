import { useRecoilValue } from "recoil";
import LoginCard from "../components/LoginCard";
import SignupCard from "../components/SignupCard";
import { authScreenAtom } from "../atoms";
import { Box } from "@chakra-ui/react";
import "../styles/CyanGradientBackground.css";
import { useEffect } from "react";

const AuthPage = () => {
	const authScreenState = useRecoilValue(authScreenAtom);

	// Add effect to disable scrolling on auth page
	useEffect(() => {
		// Add the auth-page-no-scroll class to the body
		document.body.classList.add('auth-page-no-scroll');

		// Cleanup function to remove the class when component unmounts
		return () => {
			document.body.classList.remove('auth-page-no-scroll');
		};
	}, []);

	// No background elements or animations

	return (
		<Box
			position="relative"
			height="100vh"
			overflow="hidden"
			bg="transparent"
			display="flex"
			alignItems="center"
			justifyContent="center"
		>
			{/* Cyan gradient background */}
			<div className="cyan-gradient-background"></div>

			{/* Auth card */}
			{authScreenState === "login" ? <LoginCard /> : <SignupCard />}
		</Box>
	);
};

export default AuthPage;
