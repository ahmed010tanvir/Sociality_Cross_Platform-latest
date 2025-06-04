import { Flex, Box } from "@chakra-ui/react";
import { Heart, ChatCircle } from "phosphor-react";

/**
 * Comment actions component
 * Displays like and reply buttons for a comment
 */
const CommentActions = ({ liked, onLike, onReply }) => {
  return (
    <Flex mt={1} gap={4}>
      {/* Reply icon */}
      <Box
        onClick={onReply}
        className="clean-icon"
      >
        <ChatCircle
          size={20}
          weight="regular"
          color="#616161"
        />
      </Box>

      {/* Like icon */}
      <Box
        onClick={onLike}
        className="clean-icon"
      >
        <Heart
          size={20}
          weight={liked ? "fill" : "regular"}
          color={liked ? "#ff3b5c" : "#616161"}
        />
      </Box>
    </Flex>
  );
};

export default CommentActions;
