import { Flex, Box, Text } from "@chakra-ui/react";
import { ChatCircle } from "phosphor-react";

/**
 * Show comments button component
 * Button to show comments for a post
 */
const ShowCommentsButton = ({ repliesCount, onClick }) => {
  return (
    <Flex
      align="center"
      gap={2}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      cursor="pointer"
      color="gray.500"
      _hover={{ color: "gray.300" }}
    >
      <Box className="clean-icon">
        <ChatCircle size={20} weight="regular" />
      </Box>
      <Text fontSize="sm">
        Show {repliesCount} {repliesCount === 1 ? "reply" : "replies"}
      </Text>
    </Flex>
  );
};

export default ShowCommentsButton;
