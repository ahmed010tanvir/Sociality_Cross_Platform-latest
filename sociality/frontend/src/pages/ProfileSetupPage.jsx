import {
	Button,
	Flex,
	FormControl,
	FormLabel,
	Heading,
	Input,
	Stack,
	Avatar,
	Box,
	Text,
	Divider,
	InputGroup,
	InputLeftElement,
	Textarea,
	Alert,
	AlertIcon,
	FormErrorMessage,
} from "@chakra-ui/react";
import { useRef, useState, useEffect } from "react";
import { useSetRecoilState, useRecoilValue } from "recoil";
import { useNavigate } from "react-router-dom";
import { FaUser, FaIdCard, FaQuoteLeft } from "react-icons/fa";
import { userAtom } from "../atoms";
import usePreviewImg from "../hooks/usePreviewImg";
import useShowToast from "../hooks/useShowToast";
import { fetchWithSession, setCurrentTabUser, validateAuthentication, handleAuthenticationError } from "../utils/api";

const ProfileSetupPage = () => {
	const user = useRecoilValue(userAtom);
	const setUser = useSetRecoilState(userAtom);
	const [loading, setLoading] = useState(false);
	const [inputs, setInputs] = useState({
		name: "",
		username: "",
		bio: "",
	});
	const [initialLoad, setInitialLoad] = useState(true);
	const [errors, setErrors] = useState({});
	const fileRef = useRef(null);
	const { handleImageChange, imgUrl, setImgUrl } = usePreviewImg();
	const showToast = useShowToast();
	const navigate = useNavigate();

	// Pre-populate form with existing user data
	useEffect(() => {
		if (user && initialLoad) {
			setInputs({
				name: user.name || "",
				username: user.username || "",
				bio: user.bio || "",
			});
			if (user.profilePic) {
				setImgUrl(user.profilePic);
			}
			setInitialLoad(false);
		}
	}, [user, initialLoad, setImgUrl]);

	const validateForm = () => {
		const newErrors = {};

		if (!inputs.name.trim()) {
			newErrors.name = "Display name is required";
		}

		if (!inputs.username.trim()) {
			newErrors.username = "Username is required";
		} else if (inputs.username.length < 3) {
			newErrors.username = "Username must be at least 3 characters";
		} else if (!/^[a-zA-Z0-9_]+$/.test(inputs.username)) {
			newErrors.username = "Username can only contain letters, numbers, and underscores";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async () => {
		if (!validateForm()) return;

		setLoading(true);
		try {
			// First, validate authentication
			console.log('Validating authentication before profile completion...');
			const isAuthenticated = await validateAuthentication();
			if (!isAuthenticated) {
				console.log('Authentication validation failed, redirecting to login');
				handleAuthenticationError(navigate, setUser, showToast);
				return;
			}
			console.log('Authentication validation successful');

			const res = await fetchWithSession("/api/users/complete-profile", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ ...inputs, profilePic: imgUrl }),
			});

			// Check if response is ok
			if (!res.ok) {
				if (res.status === 401) {
					handleAuthenticationError(navigate, setUser, showToast);
					return;
				}
				throw new Error(`HTTP error! status: ${res.status}`);
			}

			// Check if response is JSON
			const contentType = res.headers.get("content-type");
			if (!contentType || !contentType.includes("application/json")) {
				throw new Error("Server returned non-JSON response");
			}

			const data = await res.json();

			if (data.error) {
				showToast("Error", data.error, "error");
				return;
			}

			showToast("Success", "Profile setup completed successfully!", "success");

			// Ensure session path is preserved from the original user data
			const updatedUserData = {
				...data,
				sessionPath: user?.sessionPath || data.sessionPath
			};

			setUser(updatedUserData);
			// Store user data in tab-specific storage with preserved session path
			setCurrentTabUser(updatedUserData);

			// Small delay to ensure state is updated before navigation
			setTimeout(() => {
				navigate("/", { replace: true });
			}, 100);
		} catch (error) {
			console.error("Profile completion error:", error);
			if (error.message.includes("JSON")) {
				showToast("Error", "Server response error. Please try again.", "error");
			} else if (error.message.includes("401") || error.message.includes("Unauthorized")) {
				handleAuthenticationError(navigate, setUser, showToast);
			} else {
				showToast("Error", error.message || "Failed to complete profile setup", "error");
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
				<Flex direction="column" align="center" justify="center" my={6} px={4}>
				{/* Main Container */}
				<Stack
					spacing={6}
					w="full"
					maxW="md"
					bg="#101010"
					rounded="xl"
					borderWidth="1px"
					borderColor="gray.700"
					boxShadow="0 4px 20px rgba(0, 0, 0, 0.3)"
					p={6}
					className="glass-card"
					position="relative"
				>
					{/* Header */}
					<Flex direction="column" align="center" mb={2}>
						<Heading
							lineHeight={1.1}
							fontSize={{ base: "2xl", sm: "3xl" }}
							bgGradient="linear(to-r, rgba(0, 204, 133, 0.8), rgba(0, 121, 185, 0.8))"
							bgClip="text"
							fontWeight="bold"
						>
							Complete Your Profile
						</Heading>
						<Text fontSize="sm" color="gray.400" mt={1}>
							{user?.isGoogleUser
								? "Set up your profile to get started with Sociality"
								: "Complete your profile to start connecting with others"
							}
						</Text>
					</Flex>

					<Divider borderColor="rgba(0, 204, 133, 0.2)" />

					{/* Welcome Alert for Google OAuth users */}
					{user?.isGoogleUser && (
						<Alert
							status="success"
							borderRadius="md"
							bg="rgba(0, 204, 133, 0.1)"
							borderColor="rgba(0, 204, 133, 0.3)"
							borderWidth="1px"
						>
							<AlertIcon color="rgba(0, 204, 133, 0.8)" />
							<Box>
								<Text fontWeight="semibold" color="white">Google Account Connected</Text>
								<Text fontSize="sm" color="gray.300">
									Your Google account has been successfully connected.
									Please complete your profile setup to start using Sociality.
								</Text>
							</Box>
						</Alert>
					)}

					{/* Avatar Section */}
					<FormControl id="userName">
						<Flex direction="column" align="center" justify="center">
							<Box
								position="relative"
								mb={4}
								cursor="pointer"
								onClick={() => fileRef.current.click()}
								transition="all 0.3s ease"
								_hover={{ transform: "scale(1.05)" }}
							>
								<Avatar
									size="2xl"
									src={imgUrl || user?.profilePic}
									boxShadow="0 4px 12px rgba(0, 0, 0, 0.2)"
									border="3px solid"
									borderColor="rgba(0, 204, 133, 0.3)"
								/>
								<Box
									position="absolute"
									bottom="0"
									right="0"
									bg="rgba(0, 204, 133, 0.8)"
									p={1}
									borderRadius="full"
									boxShadow="0 2px 6px rgba(0, 0, 0, 0.2)"
								>
									<FaUser color="white" size={14} />
								</Box>
							</Box>
							<Button
								size="sm"
								bg="rgba(0, 204, 133, 0.2)"
								color="white"
								borderWidth="1px"
								borderColor="rgba(0, 204, 133, 0.5)"
								_hover={{
									bg: "rgba(0, 204, 133, 0.3)",
									transform: "translateY(-2px)",
									borderColor: "rgba(0, 204, 133, 0.7)"
								}}
								transition="all 0.2s"
								borderRadius="md"
								fontWeight="medium"
								onClick={() => fileRef.current.click()}
								boxShadow="0 2px 6px rgba(0, 0, 0, 0.1)"
								px={4}
								py={2}
								_active={{
									transform: "scale(0.98)",
									boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
								}}
								leftIcon={<FaUser size={14} />}
							>
								Choose Avatar
							</Button>
							<Input type="file" hidden ref={fileRef} onChange={handleImageChange} accept="image/*" />
						</Flex>
					</FormControl>

					{/* Form Fields */}
					<Stack spacing={4}>
						{/* Full Name */}
						<FormControl isInvalid={errors.name}>
							<FormLabel fontWeight="medium" color="gray.300">Display Name *</FormLabel>
							<InputGroup>
								<InputLeftElement pointerEvents="none">
									<FaUser color="rgba(0, 204, 133, 0.6)" />
								</InputLeftElement>
								<Input
									placeholder="Enter your display name"
									value={inputs.name}
									onChange={(e) => setInputs({ ...inputs, name: e.target.value })}
									_placeholder={{ color: "gray.500" }}
									type="text"
									bg="rgba(0, 0, 0, 0.2)"
									borderColor="gray.600"
									borderRadius="md"
									_hover={{ borderColor: "gray.500" }}
									_focus={{
										borderColor: "rgba(0, 204, 133, 0.6)",
										boxShadow: "0 0 0 1px rgba(0, 204, 133, 0.6)"
									}}
									transition="all 0.3s ease"
								/>
							</InputGroup>
							<FormErrorMessage>{errors.name}</FormErrorMessage>
						</FormControl>

						{/* Username */}
						<FormControl isInvalid={errors.username}>
							<FormLabel fontWeight="medium" color="gray.300">Username *</FormLabel>
							<InputGroup>
								<InputLeftElement pointerEvents="none">
									<FaIdCard color="rgba(0, 204, 133, 0.6)" />
								</InputLeftElement>
								<Input
									placeholder="Choose a unique username"
									value={inputs.username}
									onChange={(e) => setInputs({ ...inputs, username: e.target.value })}
									_placeholder={{ color: "gray.500" }}
									type="text"
									bg="rgba(0, 0, 0, 0.2)"
									borderColor="gray.600"
									borderRadius="md"
									_hover={{ borderColor: "gray.500" }}
									_focus={{
										borderColor: "rgba(0, 204, 133, 0.6)",
										boxShadow: "0 0 0 1px rgba(0, 204, 133, 0.6)"
									}}
									transition="all 0.3s ease"
								/>
							</InputGroup>
							<FormErrorMessage>{errors.username}</FormErrorMessage>
							<Text fontSize="xs" color="gray.500" mt={1}>
								This will be your unique identifier on Sociality
							</Text>
						</FormControl>

						{/* Bio */}
						<FormControl>
							<FormLabel fontWeight="medium" color="gray.300">Bio</FormLabel>
							<InputGroup>
								<InputLeftElement pointerEvents="none">
									<FaQuoteLeft color="rgba(0, 204, 133, 0.6)" />
								</InputLeftElement>
								<Textarea
									placeholder="Tell us about yourself (optional)"
									value={inputs.bio}
									onChange={(e) => setInputs({ ...inputs, bio: e.target.value })}
									_placeholder={{ color: "gray.500" }}
									bg="rgba(0, 0, 0, 0.2)"
									borderColor="gray.600"
									borderRadius="md"
									_hover={{ borderColor: "gray.500" }}
									_focus={{
										borderColor: "rgba(0, 204, 133, 0.6)",
										boxShadow: "0 0 0 1px rgba(0, 204, 133, 0.6)"
									}}
									transition="all 0.3s ease"
									pl={10}
									minH="100px"
									resize="vertical"
								/>
							</InputGroup>
							<Text fontSize="xs" color="gray.500" mt={1}>
								{inputs.bio.length}/200 characters
							</Text>
						</FormControl>
					</Stack>

					{/* Submit Button */}
					<Stack spacing={6} pt={2}>
						<Button
							bg="linear-gradient(135deg, rgba(0, 204, 133, 0.8) 0%, rgba(0, 121, 185, 0.8) 100%)"
							color="white"
							size="lg"
							_hover={{
								bg: "linear-gradient(135deg, rgba(0, 204, 133, 0.9) 0%, rgba(0, 121, 185, 0.9) 100%)",
								transform: "translateY(-2px)",
								boxShadow: "0 6px 20px rgba(0, 204, 133, 0.3)"
							}}
							_active={{
								transform: "scale(0.98)",
								boxShadow: "0 2px 10px rgba(0, 204, 133, 0.2)"
							}}
							transition="all 0.3s ease"
							borderRadius="md"
							fontWeight="semibold"
							boxShadow="0 4px 15px rgba(0, 204, 133, 0.2)"
							isLoading={loading}
							loadingText="Setting up your profile..."
							type="submit"
							w="full"
						>
							Complete Setup
						</Button>
						<Text fontSize="xs" color="gray.500" textAlign="center">
							* Required fields
						</Text>
					</Stack>
				</Stack>
			</Flex>
		</form>
	);
};

export default ProfileSetupPage;
