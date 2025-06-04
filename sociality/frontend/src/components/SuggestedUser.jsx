import { Avatar, Box, Button, Text, VStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import useFollowUnfollow from "../hooks/useFollowUnfollow";

const SuggestedUser = ({ user }) => {
	const { handleFollowUnfollow, following, updating } = useFollowUnfollow(user);

	return (
		// Card Container with Threads-like design
		<Box
			p={4}
			bg="#1E1E1E"
			color="white"
			borderRadius="2xl" // More rounded corners like in Threads
			borderWidth="1px"
			borderColor="rgba(255, 255, 255, 0.08)"
			mx={2} // Add horizontal margin for spacing in the slider
			minH="180px" // Slightly reduced height for more compact look
			display="flex"
			flexDirection="column"
			justifyContent="space-between" // Pushes button to the bottom
			className="suggested-user-card" // Apply our custom class for styling
			transition="transform 0.3s ease"
			_hover={{
				transform: "translateY(-2px)"
			}}
		>
			<VStack spacing={3} alignItems="center" flexGrow={1}>
				{/* User Info Link */}
				<Link to={`/${user.username}`}>
					<Avatar
						size="lg"
						src={user.profilePic}
						name={user.name}
						mb={2}
						borderRadius="full"
					/>
					<Text fontSize={"md"} fontWeight={"bold"} textAlign="center" color="white">
						{user.name}
					</Text>
					<Text color={"gray.400"} fontSize={"sm"} textAlign="center">
						@{user.username}
					</Text>
				</Link>
			</VStack>

			{/* Follow/Unfollow Button with Threads-like styling */}
			<Button
				mt={4} // Margin top to separate from user info
				w="full" // Make button full width of the card
				size={"sm"}
				bg={following ? "transparent" : "white"}
				color={following ? "white" : "black"}
				borderWidth={following ? "1px" : "0"}
				borderColor={following ? "rgba(255, 255, 255, 0.24)" : "transparent"}
				transition="background 0.2s"
				borderRadius="full" // Fully rounded button
				fontWeight="medium"
				onClick={handleFollowUnfollow}
				isLoading={updating}
				py={5} // Slightly taller button
				_hover={{}} // Remove hover effects
			>
				{following ? "Unfollow" : "Follow"}
			</Button>
		</Box>
	);
};

export default SuggestedUser;

//  SuggestedUser component, if u want to copy and paste as shown in the tutorial

{
	/* <Flex gap={2} justifyContent={"space-between"} alignItems={"center"}>
			<Flex gap={2} as={Link} to={`${user.username}`}>
				<Avatar src={user.profilePic} />
				<Box>
					<Text fontSize={"sm"} fontWeight={"bold"}>
						{user.username}
					</Text>
					<Text color={"gray.light"} fontSize={"sm"}>
						{user.name}
					</Text>
				</Box>
			</Flex>
			<Button
				size={"sm"}
				color={following ? "black" : "white"}
				bg={following ? "white" : "blue.400"}
				onClick={handleFollow}
				isLoading={updating}
				_hover={{
					color: following ? "black" : "white",
					opacity: ".8",
				}}
			>
				{following ? "Unfollow" : "Follow"}
			</Button>
		</Flex> */
}
