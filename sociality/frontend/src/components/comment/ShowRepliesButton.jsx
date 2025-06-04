import { Flex, Text } from "@chakra-ui/react";

/**
 * Show replies button component
 * Button to show or hide replies to a comment
 */
const ShowRepliesButton = ({ showReplies, repliesCount, onClick }) => {
  if (repliesCount === 0) return null;
  
  return (
    <Flex
      mt={2}
      ml={1}
      align="center"
      onClick={onClick}
      cursor="pointer"
      width="fit-content"
    >
      <Text
        fontSize="xs"
        color="blue.400"
        fontWeight="medium"
        _hover={{ textDecoration: "underline" }}
      >
        {showReplies ? "Hide" : "Show"} {repliesCount} {repliesCount === 1 ? "reply" : "replies"}
      </Text>
    </Flex>
  );
};

export default ShowRepliesButton;
