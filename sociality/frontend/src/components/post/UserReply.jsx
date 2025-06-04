import { Box, Text, Flex } from "@chakra-ui/react";

/**
 * User reply component
 * Displays a user's reply to a post with a vertical line connector
 */
const UserReply = ({ reply }) => {
  if (!reply) return null;

  return (
    <Box
      mt={3}
      p={3}
      borderRadius="xl"
      bg="#101010" // Set background color to #101010
      className="threads-post-card" // Apply our custom class
      position="relative"
    >
      {/* Vertical line connector */}
      <Box
        position="absolute"
        left="12px"
        top="-3px" // Extend slightly above the box
        width="2px"
        height="calc(100% - 15px)" // Adjust height to not extend all the way to the bottom
        bg="rgba(113, 118, 123, 0.4)" // Twitter/X style gray line
      />

      <Flex pl={6}> {/* Add padding to accommodate the vertical line */}
        <Box>
          <Text fontSize="sm" fontStyle="italic" color="gray.light">
            Your reply:
          </Text>
          <Text
            fontSize="sm"
            overflowWrap="break-word"
            wordBreak="break-word"
            whiteSpace="pre-wrap"
            sx={{
              hyphens: "auto"
            }}
          >
            {reply.text}
          </Text>
        </Box>
      </Flex>
    </Box>
  );
};

export default UserReply;
