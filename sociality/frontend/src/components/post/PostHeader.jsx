import { Flex, Text, Menu, MenuButton, MenuList, MenuItem, IconButton } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import useShowToast from "../../hooks/useShowToast";

/**
 * Post header component
 * Displays the username, timestamp, and menu options for a post
 */
const PostHeader = ({ post, currentUser, onDeletePost, onNotInterested }) => {
  const showToast = useShowToast();

  // Handle copy link to clipboard
  const handleCopyLink = (e) => {
    e.stopPropagation();
    const postUrl = `${window.location.origin}/${post.postedBy.username}/post/${post._id}`;
    navigator.clipboard.writeText(postUrl);
    showToast("Success", "Post link copied to clipboard", "success");
  };

  return (
    <Flex justifyContent="space-between" w="full" alignItems="center">
      {/* User Info */}
      <Flex alignItems="center" gap={2}>
        <Link to={`/${post.postedBy.username}`} onClick={(e) => e.stopPropagation()}>
          <Text fontSize="sm" fontWeight="bold">
            {post.postedBy.username}
          </Text>
        </Link>
      </Flex>
      
      {/* Timestamp, Repost Icon, and Menu */}
      <Flex gap={4} alignItems="center">
        {/* Show repost icon if the post has been reposted */}
        {post.reposts && post.reposts.length > 0 && (
          <RepostIcon />
        )}
        
        <Text fontSize="xs" textAlign="right" color="gray.light">
          {formatDistanceToNow(new Date(post.createdAt))} ago
        </Text>

        {/* Three Dots Menu */}
        <Menu placement="bottom-end" isLazy>
          <MenuButton
            as={IconButton}
            icon={<ThreeDotsIcon />}
            variant="ghost"
            aria-label="Options"
            size="sm"
            color="gray.500"
            _hover={{
              color: "white",
              bg: "rgba(0, 204, 133, 0.1)",
              borderColor: "rgba(0, 204, 133, 0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <MenuList
            fontSize="sm"
            bg="#101010"
            borderColor="gray.700"
            minW="180px"
            p={2}
            boxShadow="0 4px 12px rgba(0, 0, 0, 0.2)"
            className="glass-card"
          >
            {currentUser?._id === post.postedBy._id ? (
              <MenuItem
                icon={<DeleteIcon />}
                color="red.400"
                bg="#101010"
                _hover={{
                  bg: "rgba(229, 62, 62, 0.1)",
                  color: "red.300"
                }}
                borderRadius="md"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePost(e);
                }}
              >
                Delete post
              </MenuItem>
            ) : (
              <MenuItem
                icon={<NotInterestedIcon />}
                bg="#101010"
                _hover={{
                  bg: "rgba(0, 204, 133, 0.1)",
                  color: "white"
                }}
                borderRadius="md"
                onClick={(e) => onNotInterested(e)}
              >
                Not interested
              </MenuItem>
            )}
            <MenuItem
              icon={<CopyIcon />}
              bg="#101010"
              _hover={{
                bg: "rgba(0, 204, 133, 0.1)",
                color: "white"
              }}
              borderRadius="md"
              onClick={handleCopyLink}
            >
              Copy link
            </MenuItem>
          </MenuList>
        </Menu>
      </Flex>
    </Flex>
  );
};

// Icon components
const RepostIcon = () => (
  <svg
    aria-label='Repost'
    color="currentColor"
    fill='none'
    height='16'
    width='16'
    role='img'
    viewBox='0 0 24 24'
  >
    <path
      d="M4 9h13l-3-3m9 13H10l3 3M5 5v5h5M19 19v-5h-5"
      stroke='currentColor'
      strokeWidth='1.8'
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ThreeDotsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const DeleteIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18"></path>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const NotInterestedIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
  </svg>
);

const CopyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

export default PostHeader;
