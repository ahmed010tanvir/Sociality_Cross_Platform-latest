import { Flex, Text, Menu, MenuButton, MenuList, MenuItem, IconButton } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { DotsThreeVertical, Trash } from "phosphor-react";
import { formatDistanceToNow } from "date-fns";

/**
 * Comment header component
 * Displays username, timestamp, and menu options for a comment
 */
const CommentHeader = ({ reply, username, timeAgo, currentUser, onOpenDeleteAlert, showNewBadge }) => {
  return (
    <Flex align="center" gap={1} justify="space-between" width="100%">
      <Flex align="center" gap={1}>
        <Text fontWeight="bold" fontSize="sm" color="white">
          {username}
        </Text>
        <Text fontSize="xs" color="gray.500">
          · {timeAgo} ago
        </Text>
        {showNewBadge && (
          <Text
            fontSize="xs"
            color="green.400"
            fontWeight="bold"
            ml={1}
            bg="rgba(0, 204, 133, 0.1)"
            px={2}
            py={0.5}
            borderRadius="full"
            border="1px solid rgba(0, 204, 133, 0.3)"
          >
            Your New Reply
          </Text>
        )}
      </Flex>

      {/* Three dots menu */}
      {currentUser && (currentUser._id === reply.userId) && (
        <Menu placement="bottom-end" isLazy>
          <MenuButton
            as={IconButton}
            icon={<DotsThreeVertical size={16} />}
            variant="ghost"
            size="xs"
            color="gray.500"
            aria-label="Comment options"
            _hover={{
              color: "white",
              bg: "rgba(0, 204, 133, 0.1)",
              borderColor: "rgba(0, 204, 133, 0.3)"
            }}
          />
          <MenuList
            minW="180px"
            bg="#101010"
            borderColor="gray.700"
            p={2}
            boxShadow="0 4px 12px rgba(0, 0, 0, 0.2)"
            className="glass-card"
          >
            <MenuItem
              icon={<Trash size={14} />}
              bg="#101010"
              _hover={{
                bg: "rgba(229, 62, 62, 0.1)",
                color: "red.300"
              }}
              color="red.400"
              borderRadius="md"
              onClick={onOpenDeleteAlert}
            >
              Delete comment
            </MenuItem>
          </MenuList>
        </Menu>
      )}
    </Flex>
  );
};



export default CommentHeader;
