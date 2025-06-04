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
	IconButton,
	Divider,
	InputGroup,
	InputLeftElement,
	Textarea,
} from "@chakra-ui/react";
import { useRef, useState, useEffect } from "react";
import { useRecoilState } from "recoil";
import { useNavigate } from "react-router-dom";
import { ArrowBackIcon } from "@chakra-ui/icons";
import { FaUser, FaEnvelope, FaLock, FaIdCard, FaQuoteLeft } from "react-icons/fa";
import { userAtom } from "../atoms";
import usePreviewImg from "../hooks/usePreviewImg";
import useShowToast from "../hooks/useShowToast";
import { fetchWithSession } from "../utils/api";

export default function UpdateProfilePage() {
	const navigate = useNavigate();
	const [user, setUser] = useRecoilState(userAtom);
	const [inputs, setInputs] = useState({
		name: "",
		username: "",
		email: "",
		bio: "",
		password: "",
	});

	useEffect(() => {
		if (user) {
			setInputs({
				name: user.name || "",
				username: user.username || "",
				email: user.email || "",
				bio: user.bio || "",
				password: "",
			});
		}
	}, [user]);
	const fileRef = useRef(null);
	const [updating, setUpdating] = useState(false);

	const showToast = useShowToast();

	const { handleImageChange, imgUrl } = usePreviewImg();

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (updating) return;
		if (inputs.password && inputs.password.length < 6) {
			showToast("Error", "Password must be at least 6 characters", "error");
			return;
		}
		setUpdating(true);
		try {
			const res = await fetchWithSession(`/api/users/update/${user._id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ ...inputs, profilePic: imgUrl }),
			});
			if (res.ok) {
				const data = await res.json(); // updated user object
				showToast("Success", "Profile updated successfully", "success");
				setUser(data);
				localStorage.setItem("user-threads", JSON.stringify(data));
			} else {
				const errorData = await res.json().catch(() => ({ error: 'Failed to update profile' }));
				showToast("Error", errorData.error || 'Failed to update profile', "error");
			}
		} catch (error) {
			showToast("Error", error, "error");
		} finally {
			setUpdating(false);
		}
	};

	return (
		<form onSubmit={handleSubmit}>
			<Flex direction="column" align="center" justify="center" my={6} px={4}>
				{/* Back Button */}
				<Box alignSelf="flex-start" mb={4}>
					<IconButton
						icon={<ArrowBackIcon boxSize={5} />}
						aria-label="Go back"
						variant="ghost"
						color="white"
						_hover={{
							color: "rgba(0, 204, 133, 0.9)",
							bg: "rgba(0, 204, 133, 0.1)"
						}}
						onClick={() => navigate(`/${user.username}`)}
						size="md"
						borderRadius="md"
					/>
				</Box>

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
							Edit Your Profile
						</Heading>
						<Text fontSize="sm" color="gray.400" mt={1}>
							Update your personal information
						</Text>
					</Flex>

					<Divider borderColor="rgba(0, 204, 133, 0.2)" />

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
									src={imgUrl || user.profilePic}
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
								Change Avatar
							</Button>
							<Input type="file" hidden ref={fileRef} onChange={handleImageChange} />
						</Flex>
					</FormControl>

					<Divider borderColor="rgba(0, 204, 133, 0.2)" />

					{/* Form Fields */}
					<Stack spacing={4}>
						{/* Full Name */}
						<FormControl>
							<FormLabel fontWeight="medium" color="gray.300">Full Name</FormLabel>
							<InputGroup>
								<InputLeftElement pointerEvents="none">
									<FaUser color="rgba(0, 204, 133, 0.6)" />
								</InputLeftElement>
								<Input
									placeholder="John Doe"
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
						</FormControl>

						{/* Username */}
						<FormControl>
							<FormLabel fontWeight="medium" color="gray.300">Username</FormLabel>
							<InputGroup>
								<InputLeftElement pointerEvents="none">
									<FaIdCard color="rgba(0, 204, 133, 0.6)" />
								</InputLeftElement>
								<Input
									placeholder="johndoe"
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
						</FormControl>

						{/* Email */}
						<FormControl>
							<FormLabel fontWeight="medium" color="gray.300">Email Address</FormLabel>
							<InputGroup>
								<InputLeftElement pointerEvents="none">
									<FaEnvelope color="rgba(0, 204, 133, 0.6)" />
								</InputLeftElement>
								<Input
									placeholder="your-email@example.com"
									value={inputs.email}
									onChange={(e) => setInputs({ ...inputs, email: e.target.value })}
									_placeholder={{ color: "gray.500" }}
									type="email"
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
						</FormControl>

						{/* Bio */}
						<FormControl>
							<FormLabel fontWeight="medium" color="gray.300">Bio</FormLabel>
							<InputGroup>
								<InputLeftElement pointerEvents="none">
									<FaQuoteLeft color="rgba(0, 204, 133, 0.6)" />
								</InputLeftElement>
								<Textarea
									placeholder="Tell us about yourself"
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
						</FormControl>

						{/* Password */}
						<FormControl>
							<FormLabel fontWeight="medium" color="gray.300">Password</FormLabel>
							<InputGroup>
								<InputLeftElement pointerEvents="none">
									<FaLock color="rgba(0, 204, 133, 0.6)" />
								</InputLeftElement>
								<Input
									placeholder="Leave blank to keep current password"
									value={inputs.password}
									onChange={(e) => setInputs({ ...inputs, password: e.target.value })}
									_placeholder={{ color: "gray.500" }}
									type="password"
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
							<Text fontSize="xs" color="gray.500" mt={1}>
								Must be at least 6 characters
							</Text>
						</FormControl>
					</Stack>

					<Divider borderColor="rgba(0, 204, 133, 0.2)" mt={2} />

					{/* Action Buttons */}
					<Stack spacing={4} direction={["column", "row"]} pt={2}>
						<Button
							bg="transparent"
							color="white"
							borderWidth="1px"
							borderColor="gray.600"
							_hover={{
								bg: "rgba(255, 255, 255, 0.1)",
								transform: "translateY(-2px)",
								borderColor: "gray.500"
							}}
							transition="all 0.2s"
							borderRadius="md"
							fontWeight="medium"
							w="full"
							onClick={() => navigate(`/${user.username}`)}
							boxShadow="0 2px 6px rgba(0, 0, 0, 0.1)"
							_active={{
								transform: "scale(0.98)",
								boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
							}}
						>
							Cancel
						</Button>
						<Button
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
							w="full"
							type="submit"
							isLoading={updating}
							boxShadow="0 2px 6px rgba(0, 0, 0, 0.1)"
							_active={{
								transform: "scale(0.98)",
								boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
							}}
						>
							Save Changes
						</Button>
					</Stack>
				</Stack>
			</Flex>
		</form>
	);
}
