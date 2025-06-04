import { Button, Text, Box, Flex, VStack, Divider, AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay } from "@chakra-ui/react";
import useShowToast from "../hooks/useShowToast";
import useLogout from "../hooks/useLogout";
import { useState, useRef } from "react";
import { SignOut, Trash } from "phosphor-react";
import "../styles/GradientAnimation.css";
import { fetchWithSession } from "../utils/api";

export const SettingsPage = () => {
	const showToast = useShowToast();
	const logout = useLogout();

	// For delete account confirmation dialog
	const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
	const cancelRef = useRef();

	const onDeleteAlertClose = () => setIsDeleteAlertOpen(false);
	const onDeleteAlertOpen = () => setIsDeleteAlertOpen(true);





	const deleteAccount = async () => {
		try {
			const res = await fetchWithSession("/api/users/delete", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
			});

			// Check if the response is ok before trying to parse JSON
			if (!res.ok) {
				// If the API endpoint doesn't exist or returns an error
				if (res.status === 404) {
					showToast("Error", "API endpoint not found. Backend implementation needed.", "error");
				} else {
					showToast("Error", `Server error: ${res.status}`, "error");
				}
				onDeleteAlertClose(); // Close the dialog
				return;
			}

			// Try to parse the JSON response
			let data;
			try {
				data = await res.json();
			} catch (parseError) {
				showToast("Error", "Invalid response from server", "error");
				onDeleteAlertClose(); // Close the dialog
				return;
			}

			if (data.error) {
				showToast("Error", data.error, "error");
				onDeleteAlertClose(); // Close the dialog
				return;
			}

			// Success case
			await logout();
			showToast("Success", "Your account has been permanently deleted", "success");
			onDeleteAlertClose(); // Close the dialog
		} catch (error) {
			showToast("Error", error.message, "error");
			onDeleteAlertClose(); // Close the dialog
		}
	};

	return (
		<>
			{/* Simple background */}
			<Box
				bg="#101010"
				position="fixed"
				top="0"
				left="0"
				right="0"
				bottom="0"
				zIndex="-1"
			></Box>

			<VStack spacing={8} align="start" width="100%" maxW="550px" mx="auto" mt={8} position="relative" zIndex={1}>
				<Text fontSize="3xl" fontWeight="bold" mb={2} ml={2}>
					Settings
				</Text>



				{/* Account Section */}
				<Box
					width="100%"
					p={6}
					borderWidth="1px"
					borderRadius="xl"
					borderColor="rgba(255, 255, 255, 0.08)"
					bg="#1a1a1a"
					boxShadow="0 4px 12px rgba(0, 0, 0, 0.2)"
					className="threads-post-card"
				>
					<Text fontSize="xl" fontWeight="bold" mb={5} color="white">
						Account
					</Text>

					{/* Logout Button */}
					<Flex justify="space-between" align="center" mb={4}>
						<Text fontWeight={"bold"}>Logout</Text>
						<Button
							size={"md"}
							bg="#1E1E1E"
							color="white"
							borderWidth="1px"
							borderColor="rgba(255, 255, 255, 0.1)"
							borderRadius="md"
							onClick={logout}
							leftIcon={<SignOut size={20} weight="bold" color="white" />}
							_hover={{
								bg: "rgba(255, 255, 255, 0.1)",
								borderColor: "rgba(255, 255, 255, 0.2)",
								transform: "translateY(-2px)"
							}}
							transition="all 0.2s"
						>
							Logout
						</Button>
					</Flex>

					<Divider my={5} borderColor="rgba(255, 255, 255, 0.08)" />

					{/* Delete Account */}
					<Flex justify="space-between" align="center">
						<Box>
							<Text fontWeight={"bold"}>Delete Your Account</Text>
							<Text fontSize="sm" color="gray.400">This action is permanent and cannot be undone</Text>
						</Box>
						<Button
							size={"md"}
							bg="rgba(229, 62, 62, 0.3)"
							color="white"
							borderWidth="1px"
							borderColor="rgba(229, 62, 62, 0.4)"
							borderRadius="md"
							onClick={onDeleteAlertOpen}
							leftIcon={<Trash size={20} weight="bold" color="white" />}
							backdropFilter="blur(8px)"
							style={{
								backdropFilter: "blur(8px)"
							}}
							_hover={{
								bg: "rgba(229, 62, 62, 0.4)"
							}}
						>
							Delete
						</Button>
					</Flex>
				</Box>
			</VStack>

			{/* Delete Account Confirmation Dialog */}
			<AlertDialog
				isOpen={isDeleteAlertOpen}
				leastDestructiveRef={cancelRef}
				onClose={onDeleteAlertClose}
				isCentered
			>
				<AlertDialogOverlay backdropFilter="blur(8px)" bg="blackAlpha.600" />
				<AlertDialogContent
					bg="#1E1E1E"
					borderColor="rgba(255, 255, 255, 0.1)"
					borderWidth="1px"
					borderRadius="xl"
					className="glass-card"
					boxShadow="0 8px 32px rgba(0, 0, 0, 0.3)"
				>
					<AlertDialogHeader fontSize="xl" fontWeight="bold" color="white">
						Delete Account
					</AlertDialogHeader>

					<AlertDialogBody>
						Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.
					</AlertDialogBody>

					<AlertDialogFooter>
						<Button
							ref={cancelRef}
							onClick={onDeleteAlertClose}
							bg="#1E1E1E"
							color="white"
							borderWidth="1px"
							borderColor="rgba(255, 255, 255, 0.1)"
							borderRadius="md"
							_hover={{
								bg: "rgba(255, 255, 255, 0.1)",
								borderColor: "rgba(255, 255, 255, 0.2)",
								transform: "translateY(-2px)"
							}}
							transition="all 0.2s"
						>
							Cancel
						</Button>
						<Button
							bg="rgba(229, 62, 62, 0.3)"
							color="white"
							borderWidth="1px"
							borderColor="rgba(229, 62, 62, 0.4)"
							borderRadius="md"
							backdropFilter="blur(8px)"
							style={{
								backdropFilter: "blur(8px)"
							}}
							_hover={{
								bg: "rgba(229, 62, 62, 0.4)"
							}}
							onClick={deleteAccount}
							ml={3}
						>
							Delete Account
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>


		</>
	);
};
