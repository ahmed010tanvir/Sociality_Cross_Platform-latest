import { Avatar } from "@chakra-ui/avatar";
import { Box, Flex, Text } from "@chakra-ui/layout";
import { useNavigate } from "react-router-dom";
import { useState, useCallback, useMemo, memo } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import { userAtom, postsAtom } from "../../atoms";
import useShowToast from "../../hooks/useShowToast";
import { markPostNotInterested } from "../../utils/api";

// Import smaller components
import PostHeader from "./PostHeader";
import ImageGallery from "./ImageGallery";
import UserReply from "./UserReply";
import CommentsSection from "./CommentsSection";
import ShowCommentsButton from "./ShowCommentsButton";
import Actions from "../Actions";

// Import optimizations
import "./PostOptimizations.css";

/**
 * Post component
 * Displays a post with all its content and interactions
 */
const Post = memo(({ post, showComments = false, isPostPage = false }) => {
  const showToast = useShowToast();
  const currentUser = useRecoilValue(userAtom);
  const [posts, setPosts] = useRecoilState(postsAtom);
  const navigate = useNavigate();
  const borderColor = "gray.700"; // Always use dark mode border color
  const [displayComments, setDisplayComments] = useState(showComments);

  // Memoize images array calculation to prevent recalculation on every render
  const images = useMemo(() => {
    // Debug post image data
    console.log("Post image data:", {
      postId: post._id,
      hasImg: !!post.img,
      img: post.img,
      hasImages: post.images && Array.isArray(post.images) && post.images.length > 0,
      images: post.images
    });

    // Check if post has multiple images in the images array
    const hasMultipleImages = post.images && Array.isArray(post.images) && post.images.length > 0;

    // If post has images array, use it; otherwise, if post has a single img, create an array with it
    let imageArray = [];

    if (hasMultipleImages) {
      // Filter out any null or undefined values
      imageArray = post.images.filter(img => img);
    } else if (post.img) {
      imageArray = [post.img];
    }

    // Validate that all images are valid URLs
    return imageArray.filter(img =>
      typeof img === 'string' &&
      (img.startsWith('http://') || img.startsWith('https://'))
    );
  }, [post._id, post.images, post.img]);

  // Memoize event handlers to prevent recreation on every render
  const handleDeletePost = useCallback(async (e) => {
    try {
      e.preventDefault();
      if (!window.confirm("Are you sure you want to delete this post?")) return;

      const res = await fetch(`/api/posts/${post._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) {
        showToast("Error", data.error, "error");
        return;
      }
      showToast("Success", "Post deleted", "success");
      setPosts(posts.filter((p) => p._id !== post._id));
    } catch (error) {
      showToast("Error", error.message, "error");
    }
  }, [post._id, posts, setPosts, showToast]);

  // Handle "Not interested" action
  const handleNotInterested = useCallback(async (e) => {
    e.stopPropagation();

    try {
      // Call API to mark post as not interested using the utility function
      await markPostNotInterested(post._id);

      // Remove post from current feed
      setPosts(posts.filter((p) => p._id !== post._id));
      showToast("Success", "You won't see this post again", "success");
    } catch (error) {
      console.error('Error marking post as not interested:', error);
      showToast("Error", "Failed to mark post as not interested", "error");
    }
  }, [post._id, posts, setPosts, showToast]);

  // Memoize the click handler to prevent recreation on every render
  const handlePostClick = useCallback((e) => {
    // Navigate on clicking the box, except when clicking interactive elements
    const interactiveElements = ["A", "BUTTON", "IMG", "svg"]; // Tags of elements that shouldn't trigger navigation
    if (
      e.target instanceof Element &&
      !interactiveElements.includes(e.target.tagName) &&
      !e.target.closest("a, button") // Check parent elements too
    ) {
      // Use requestAnimationFrame to defer navigation until after the current frame
      requestAnimationFrame(() => {
        navigate(`/${post?.postedBy?.username}/post/${post?._id}`);
      });
    }
  }, [navigate, post?._id, post?.postedBy?.username]);

  // Check if post or post.postedBy exists before rendering
  if (!post || !post.postedBy) return null;

  return (
    <Box
      p={4}
      mb={4}
      bg="#1a1a1a" // Slightly lighter background to make the box visible
      borderRadius="xl" // Rounded rectangle box
      border="1px solid rgba(255, 255, 255, 0.08)" // Subtle border for definition
      onClick={handlePostClick}
      cursor="pointer"
      className="post-container threads-post-card" // Apply optimized CSS and our custom class
      _hover={{
        bg: "#1e1e1e", // Slightly lighter on hover
        borderColor: "rgba(255, 255, 255, 0.12)"
      }}
    >
      <Flex gap={3}>
        <Flex flexDirection="column" alignItems="center">
          <Avatar
            size='md'
            name={post.postedBy.name}
            src={post.postedBy.profilePic}
            onClick={(e) => {
              e.preventDefault();
              navigate(`/${post.postedBy.username}`);
            }}
          />
        </Flex>
        <Flex flex={1} flexDirection="column" gap={2}>
          {/* Post Header */}
          <PostHeader
            post={post}
            currentUser={currentUser}
            onDeletePost={handleDeletePost}
            onNotInterested={handleNotInterested}
          />

          {/* Post Content */}
          <Text
            fontSize="sm"
            mt={1}
            overflowWrap="break-word"
            wordBreak="break-word"
            whiteSpace="pre-wrap"
            sx={{
              hyphens: "auto"
            }}
          >
            {post.text}
          </Text>

          {/* Image Gallery */}
          <ImageGallery images={images} borderColor={borderColor} />

          {/* Display User's Reply if available */}
          {post.userReply && <UserReply reply={post.userReply} borderColor={borderColor} />}

          {/* Actions */}
          <Flex gap={3} my={2} onClick={(e) => e.stopPropagation()}>
            <Actions post={post} />
          </Flex>

          {/* Show replies count button */}
          {post.replies?.length > 0 && !displayComments && isPostPage && (
            <ShowCommentsButton
              repliesCount={post.replies.length}
              onClick={() => setDisplayComments(true)}
            />
          )}

          {/* Comments Section */}
          {displayComments && post.replies?.length > 0 && (
            <CommentsSection
              post={post}
              posts={posts}
              setPosts={setPosts}
              onHideComments={() => setDisplayComments(false)}
            />
          )}
        </Flex>
      </Flex>
    </Box>
  );
});

Post.displayName = 'Post';

export default Post;
