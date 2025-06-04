import { Box, Divider } from "@chakra-ui/react";
import Comment from "../Comment";

/**
 * Child replies component
 * Displays replies to a comment
 */
const ChildReplies = ({ 
  childReplies, 
  allReplies, 
  highlightId, 
  postId, 
  onReplyAdded 
}) => {
  if (!childReplies || childReplies.length === 0) return null;

  // Create a sorted copy of child replies
  let sortedChildReplies = [...childReplies];

  // By default, sort by popularity (likes count and replies count)
  sortedChildReplies = sortedChildReplies.sort((a, b) => {
    // Calculate engagement score based on likes and replies
    const aLikes = a.likes?.length || 0;
    const bLikes = b.likes?.length || 0;

    // Count replies to this comment
    const aReplies = allReplies.filter(r => r.parentReplyId === a._id).length;
    const bReplies = allReplies.filter(r => r.parentReplyId === b._id).length;

    // Total engagement score
    const aScore = aLikes + aReplies;
    const bScore = bLikes + bReplies;

    // If scores are equal, sort by newest first
    if (bScore === aScore) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }

    // Sort by engagement score (highest first)
    return bScore - aScore;
  });

  // If there's a highlighted reply, extract it and move it to the top
  if (highlightId) {
    const highlightedReply = sortedChildReplies.find(r => r._id === highlightId);
    if (highlightedReply) {
      sortedChildReplies = sortedChildReplies.filter(r => r._id !== highlightId);
      sortedChildReplies.unshift(highlightedReply);
    }
  }

  return (
    <Box mt={2}>
      {sortedChildReplies.map((childReply, index) => (
        <Box key={childReply._id}>
          {/* Add a separator after the highlighted reply if it's the first one */}
          {index === 0 && childReply._id === highlightId && (
            <>
              <Box
                mb={2}
                position="relative"
                _after={{
                  content: '"Your Recent Reply"',
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  bg: "#101010",
                  px: "12px",
                  py: "4px",
                  fontSize: "xs",
                  fontWeight: "bold",
                  color: "green.400",
                  borderRadius: "full",
                  border: "1px solid rgba(0, 204, 133, 0.3)"
                }}
              >
                <Divider borderColor="rgba(0, 204, 133, 0.3)" />
              </Box>
              {/* Add a second separator to show where the normal sorting begins */}
              {sortedChildReplies.length > 1 && (
                <Box
                  mb={2}
                  position="relative"
                  _after={{
                    content: '"Other Replies"',
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    bg: "#101010",
                    px: "12px",
                    py: "4px",
                    fontSize: "xs",
                    color: "gray.500",
                    borderRadius: "full"
                  }}
                >
                  <Divider borderColor="gray.700" />
                </Box>
              )}
            </>
          )}
          <Comment
            reply={childReply}
            postId={postId}
            lastReply={index === sortedChildReplies.length - 1}
            onReplyAdded={onReplyAdded}
            childReplies={allReplies.filter(r => r.parentReplyId === childReply._id)}
            allReplies={allReplies}
            highlightId={highlightId}
          />
        </Box>
      ))}
    </Box>
  );
};

export default ChildReplies;
