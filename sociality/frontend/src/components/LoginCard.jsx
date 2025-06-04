import {
	Flex,
	Box,
	FormControl,
	FormLabel,
	Input,
	InputGroup,
	InputRightElement,
	Button,
	Text,
	Image,
	Center,
	VStack,
	Divider,
	HStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import { useSetRecoilState } from "recoil";
import { authScreenAtom, userAtom } from "../atoms";
import useShowToast from "../hooks/useShowToast";
import { googleOAuthPopup } from "../utils/oauthPopup";
import { setCurrentTabUser } from "../utils/api";
import { useNavigate } from "react-router-dom";

export default function LoginCard() {
	const [showPassword, setShowPassword] = useState(false);
	const setAuthScreen = useSetRecoilState(authScreenAtom);
	const setUser = useSetRecoilState(userAtom);
	const [loading, setLoading] = useState(false);
	const [googleLoading, setGoogleLoading] = useState(false);
	const navigate = useNavigate();

	const [inputs, setInputs] = useState({
		username: "",
		password: "",
	});
	const showToast = useShowToast();

	const handleLogin = async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/users/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(inputs),
			});
			const data = await res.json();
			if (data.error) {
				showToast("Error", data.error, "error");
				return;
			}
			// Store user data in tab-specific storage
			setCurrentTabUser(data);
			setUser(data);
		} catch (error) {
			showToast("Error", error, "error");
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleLogin = async () => {
		try {
			// Set loading state immediately after user click
			setGoogleLoading(true);

			// Open popup immediately to preserve user activation
			const userData = await googleOAuthPopup();

			// Set user data in Recoil state
			setUser(userData);

			// Show success message
			showToast("Success", "Successfully logged in with Google!", "success");

			// Navigate based on profile completion status
			if (userData.setupRequired || !userData.isProfileComplete) {
				showToast("Info", "Welcome! Please complete your profile setup to get started", "info");
				setTimeout(() => {
					navigate('/profile-setup', { replace: true });
				}, 100);
			} else {
				showToast("Success", "Welcome back!", "success");
				setTimeout(() => {
					navigate('/', { replace: true });
				}, 100);
			}
		} catch (error) {
			console.error('Google OAuth error:', error);
			let errorMessage = "Google login failed";

			if (error.message.includes('Popup blocked') || error.message.includes('Popups are blocked')) {
				errorMessage = "Popup blocked. Please allow popups for this site in your browser settings and try again.";
			} else if (error.message.includes('closed before completion')) {
				errorMessage = "Google login was cancelled";
			} else if (error.message.includes('user activation')) {
				errorMessage = "Please click the button directly to open Google login.";
			}

			showToast("Error", errorMessage, "error");
		} finally {
			setGoogleLoading(false);
		}
	};
	return (
		<Flex align={"center"} justify={"center"}>
			<VStack spacing={6} mx={"auto"} maxW={"lg"}>
				<Box
					rounded={"xl"}
					className="glass-effect"
					p={6}
					w={{
						base: "full",
						sm: "450px",
					}}
					transition={"all 0.3s ease"}
					_hover={{
						boxShadow: "0 8px 32px rgba(0, 204, 133, 0.15)"
					}}
					borderWidth="1px"
					borderColor="rgba(0, 204, 133, 0.2)"
					position="relative"
					_before={{
						content: '""',
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						borderRadius: "xl",
						background: "linear-gradient(145deg, rgba(0, 204, 133, 0.05), rgba(0, 121, 185, 0.05))",
						zIndex: -1,
					}}
				>
					<VStack spacing={4}>
						{/* Logo at the top - Responsive */}
						<Center w={"full"} mb={2}>
							<Image
								src="/icon.svg"
								alt="Sociality Logo"
								boxSize={{ base: "70px", sm: "80px" }}
								transition={"transform 0.3s ease"}
								_hover={{ transform: "scale(1.05)" }}
								animation="pulse 3s infinite"
								sx={{
									"@keyframes pulse": {
										"0%": { filter: "drop-shadow(0 0 0px rgba(0, 204, 133, 0.3))" },
										"50%": { filter: "drop-shadow(0 0 10px rgba(0, 204, 133, 0.5))" },
										"100%": { filter: "drop-shadow(0 0 0px rgba(0, 204, 133, 0.3))" }
									}
								}}
							/>
						</Center>

						<Text
							as="h1"
							lineHeight={1.3}
							fontSize={{ base: "2xl", sm: "3xl" }}
							color="#00CC85"
							fontWeight="bold"
							textAlign={"center"}
							mb={4}
							letterSpacing="wide"
							sx={{
								background: "linear-gradient(to right, #00CC85, #0079B9)",
								WebkitBackgroundClip: "text",
								WebkitTextFillColor: "transparent",
								display: "inline-block",
								width: "100%",
								paddingBottom: "4px" /* Add padding to ensure descenders are visible */
							}}
						>
							Login to Sociality
						</Text>

						<FormControl isRequired>
							<FormLabel color={"gray.300"}>Username</FormLabel>
							<Input
								type='text'
								value={inputs.username}
								onChange={(e) => setInputs((inputs) => ({ ...inputs, username: e.target.value }))}
								bg={"rgba(0,0,0,0.2)"}
								borderColor={"rgba(255,255,255,0.1)"}
								color={"white"}
								_hover={{
									borderColor: "rgba(255,255,255,0.3)"
								}}
								_focus={{
									borderColor: "#00cc85",
									boxShadow: "0 0 0 1px #00cc85"
								}}
								fontSize={"md"}
								placeholder="Enter your username"
							/>
						</FormControl>

						<FormControl isRequired mt={4}>
							<FormLabel color={"gray.300"}>Password</FormLabel>
							<InputGroup>
								<Input
									type={showPassword ? "text" : "password"}
									value={inputs.password}
									onChange={(e) => setInputs((inputs) => ({ ...inputs, password: e.target.value }))}
									bg={"rgba(0,0,0,0.2)"}
									borderColor={"rgba(255,255,255,0.1)"}
									color={"white"}
									_hover={{
										borderColor: "rgba(255,255,255,0.3)"
									}}
									_focus={{
										borderColor: "#00cc85",
										boxShadow: "0 0 0 1px #00cc85"
									}}
									fontSize={"md"}
									placeholder="Enter your password"
								/>
								<InputRightElement h={"full"}>
									<Button
										variant={"ghost"}
										onClick={() => setShowPassword((showPassword) => !showPassword)}
										color={"gray.400"}
										_hover={{
											color: "white"
										}}
									>
										{showPassword ? <ViewIcon /> : <ViewOffIcon />}
									</Button>
								</InputRightElement>
							</InputGroup>
						</FormControl>

						<Button
							loadingText='Logging in'
							size='lg'
							bg={"#101010"}
							color={"white"}
							borderWidth={"1px"}
							borderColor={"rgba(0, 204, 133, 0.5)"}
							_hover={{
								bg: "#151515",
								transform: "translateY(-2px)",
								borderColor: "rgba(0, 204, 133, 0.7)",
								boxShadow: "0 4px 12px rgba(0, 204, 133, 0.3)"
							}}
							_active={{
								transform: "scale(0.98)",
								boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
							}}
							onClick={handleLogin}
							isLoading={loading}
							mt={6}
							width={"full"}
							transition={"all 0.3s ease"}
							borderRadius={"md"}
							fontWeight={"bold"}
							letterSpacing={"wide"}
							boxShadow="0 2px 6px rgba(0, 0, 0, 0.1)"
							position="relative"
							overflow="hidden"
							_before={{
								content: '""',
								position: "absolute",
								top: 0,
								left: 0,
								right: 0,
								bottom: 0,
								background: "linear-gradient(to right, rgba(0, 204, 133, 0.2), rgba(0, 121, 185, 0.2))",
								zIndex: 0
							}}
						>
							<Text
								position="relative"
								zIndex={1}
								sx={{
									background: "linear-gradient(to right,rgb(255, 255, 255),rgb(255, 255, 255))",
									WebkitBackgroundClip: "text",
									WebkitTextFillColor: "transparent",
									display: "inline-block",
									paddingBottom: "2px" /* Add padding to ensure descenders are visible */
								}}
							>
								Login
							</Text>
						</Button>

						{/* Divider */}
						<HStack width="full" mt={4}>
							<Divider borderColor="rgba(255,255,255,0.2)" />
							<Text color="gray.400" fontSize="sm" px={2}>or</Text>
							<Divider borderColor="rgba(255,255,255,0.2)" />
						</HStack>

						{/* Google Login Button */}
						<Button
							size='lg'
							bg={"white"}
							color={"#333"}
							borderWidth={"1px"}
							borderColor={"rgba(255, 255, 255, 0.3)"}
							_hover={{
								bg: "#f8f9fa",
								transform: "translateY(-2px)",
								boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
							}}
							_active={{
								transform: "scale(0.98)",
								boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
							}}
							onClick={handleGoogleLogin}
							isLoading={googleLoading}
							loadingText="Opening Google..."
							width={"full"}
							transition={"all 0.3s ease"}
							borderRadius={"md"}
							fontWeight={"bold"}
							letterSpacing={"wide"}
							boxShadow="0 2px 6px rgba(0, 0, 0, 0.1)"
							leftIcon={
								!googleLoading && (
									<svg width="20" height="20" viewBox="0 0 24 24">
										<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
										<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
										<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
										<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
									</svg>
								)
							}
						>
							Continue with Google
						</Button>

						<Text align={"center"} color={"gray.400"} mt={4}>
							Don&apos;t have an account?{" "}
							<Text
								as="span"
								fontWeight="bold"
								onClick={() => setAuthScreen("signup")}
								cursor="pointer"
								_hover={{
									textDecoration: "underline"
								}}
								sx={{
									background: "linear-gradient(to right, #00CC85, #0079B9)",
									WebkitBackgroundClip: "text",
									WebkitTextFillColor: "transparent",
									display: "inline-block",
									paddingBottom: "2px" /* Add padding to ensure descenders are visible */
								}}
							>
								Sign up
							</Text>
						</Text>
					</VStack>
				</Box>
			</VStack>
		</Flex>
	);
}
