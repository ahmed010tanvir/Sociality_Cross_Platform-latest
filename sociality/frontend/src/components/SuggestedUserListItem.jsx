import { Avatar, Box, Button, Flex, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import useFollowUnfollow from "../hooks/useFollowUnfollow";

// Component specifically for list view (e.g., on Search Page)
const SuggestedUserListItem = ({ user }) => {
    const { handleFollowUnfollow, following, updating } = useFollowUnfollow(user);

    return (
        <Flex
            gap={5} // Increased gap
            justifyContent={"space-between"}
            alignItems={"center"}
            w="full"
            p={4} // Increased padding
            borderRadius="xl"
            bg="transparent"
            borderTop="1px solid rgba(255, 255, 255, 0.03)"
            borderBottom="1px solid rgba(255, 255, 255, 0.03)"
            _hover={{ bg: "rgba(255, 255, 255, 0.03)" }}
            transition="all 0.2s"
            className="search-user-item"
        >
            {/* Left side: Avatar and User Info */}
            <Flex gap={4} as={Link} to={`/${user.username}`} alignItems="center">
                <Avatar size="lg" src={user.profilePic} name={user.name} /> {/* Larger avatar */}
                <Box>
                    <Text fontSize={"md"} fontWeight={"bold"} color="white"> {/* Larger text */}
                        {user.username}
                    </Text>
                    <Text color={"gray.400"} fontSize={"sm"}>
                        {user.name}
                    </Text>
                </Box>
            </Flex>

            {/* Right side: Follow/Unfollow Button with improved styling */}
            <Button
                size={"md"} // Larger button
                bg={following ? "transparent" : "#003838"}
                color="white"
                borderWidth="1px"
                borderColor={following ? "gray.600" : "#003838"}
                _hover={{
                    bg: following ? "rgba(255, 255, 255, 0.1)" : "#004d4d",
                }}
                borderRadius="full"
                fontWeight="medium"
                onClick={handleFollowUnfollow}
                isLoading={updating}
                ml={2}
                px={6} // More horizontal padding
                py={2} // More vertical padding
                fontSize="md" // Larger text
            >
                {following ? "Unfollow" : "Follow"}
            </Button>
        </Flex>
    );
};

export default SuggestedUserListItem;
