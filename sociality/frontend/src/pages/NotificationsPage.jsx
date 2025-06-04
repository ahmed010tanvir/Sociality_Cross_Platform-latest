import { Box, Heading, Spinner, Text, Flex, Avatar, Link as ChakraLink, IconButton, Menu, MenuButton, MenuList, MenuItem } from "@chakra-ui/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Link as RouterLink } from "react-router-dom"; // For linking to profiles/posts
import useShowToast from "../hooks/useShowToast";
import { formatDistanceToNowStrict } from 'date-fns'; // For relative timestamps
import { BsThreeDotsVertical } from "react-icons/bs";
import { FaTrash } from "react-icons/fa";
import { fetchWithSession } from "../utils/api";

// Component for notifications page

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef();
  const showToast = useShowToast();

  const lastNotificationRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new window.IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const res = await fetchWithSession(`/api/notifications?page=${page}&limit=10`);
        if (res.ok) {
          const data = await res.json();

          // Get notifications array from response
          const notificationsArray = Array.isArray(data.notifications)
            ? data.notifications
            : Array.isArray(data)
              ? data
              : [];

          // Update hasMore from backend response if available
          if (data.hasMore !== undefined) {
            setHasMore(data.hasMore);
          } else {
            // Fallback to old logic if backend doesn't provide hasMore
            setHasMore(notificationsArray.length > 0);
          }

          setNotifications(prev => {
            const all = [...prev, ...notificationsArray];
            const seen = new Set();
            return all.filter(n => {
              if (!n._id) return false;
              if (seen.has(n._id)) return false;
              seen.add(n._id);
              return true;
            });
          });
        } else {
          const errorData = await res.json().catch(() => ({ error: 'Failed to fetch notifications' }));
          showToast("Error", errorData.error || 'Failed to fetch notifications', "error");
        }
      } catch (error) {
        showToast("Error", error.message, "error");
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
    // eslint-disable-next-line
  }, [page, showToast]);

  // Function to delete a notification
  const handleDeleteNotification = async (notificationId) => {
    try {
      // Optimistic update - remove from UI immediately
      setNotifications(prev => prev.filter(n => n._id !== notificationId));

      // Send delete request to server
      const res = await fetchWithSession(`/api/notifications/${notificationId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          showToast("Error", data.error, "error");
        }
      } else {
        // If there was an error, fetch all notifications again
        const errorData = await res.json().catch(() => ({ error: 'Failed to delete notification' }));
        showToast("Error", errorData.error || 'Failed to delete notification', "error");

        const refreshRes = await fetchWithSession("/api/notifications?page=1&limit=10");
        if (refreshRes.ok) {
          const refreshedData = await refreshRes.json();

          // Reset pagination state
          setPage(1);

          // Handle the new response format
          if (refreshedData.notifications) {
            setNotifications(refreshedData.notifications);
            if (refreshedData.hasMore !== undefined) {
              setHasMore(refreshedData.hasMore);
            }
          } else {
            // Fallback for old format
            setNotifications(Array.isArray(refreshedData) ? refreshedData : []);
          }
        }
      }
    } catch (error) {
      showToast("Error", error.message, "error");
    }
  };

  const renderNotificationText = (notification) => {
    const timeAgo = formatDistanceToNowStrict(new Date(notification.createdAt), { addSuffix: true });

    // Handle case where sender might be null
    const senderLink = notification.sender ? (
      <ChakraLink as={RouterLink} to={`/${notification.sender.username}`} fontWeight="bold" fontSize={{ base: "sm", md: "md" }}>
        {notification.sender.username}
      </ChakraLink>
    ) : (
      <Text as="span" fontWeight="bold" fontSize={{ base: "sm", md: "md" }}>
        A user
      </Text>
    );

    switch (notification.type) {
      case "follow":
        return (
          <Text color="white" bg="transparent" fontSize={{ base: "sm", md: "md" }}>
            {senderLink} started following you{' '}
            <span style={{ color: 'gray', fontSize: 'smaller' }}>({timeAgo})</span>
          </Text>
        );
      case "like":
        return (
          <Text color="white" bg="transparent" fontSize={{ base: "sm", md: "md" }}>
            {senderLink} liked your{' '}
            {notification.recipient && notification.postId ? (
              <ChakraLink as={RouterLink} to={`/${notification.recipient.username}/post/${notification.postId}`} fontWeight="bold" fontSize={{ base: "sm", md: "md" }}>
                post
              </ChakraLink>
            ) : (
              <Text as="span" fontWeight="bold" fontSize={{ base: "sm", md: "md" }}>
                post
              </Text>
            )}{' '}
            <span style={{ color: 'gray', fontSize: 'smaller' }}>({timeAgo})</span>
          </Text>
        );
      case "comment":
        return (
          <Text color="white" bg="transparent" fontSize={{ base: "sm", md: "md" }}>
            {senderLink} commented on your{' '}
            {notification.recipient && notification.postId ? (
              <ChakraLink as={RouterLink} to={`/${notification.recipient.username}/post/${notification.postId}`} fontWeight="bold" fontSize={{ base: "sm", md: "md" }}>
                post
              </ChakraLink>
            ) : (
              <Text as="span" fontWeight="bold" fontSize={{ base: "sm", md: "md" }}>
                post
              </Text>
            )}{' '}
            <span style={{ color: 'gray', fontSize: 'smaller' }}>({timeAgo})</span>
          </Text>
        );
      case "reply":
        return (
          <Text color="white" bg="transparent" fontSize={{ base: "sm", md: "md" }}>
            {senderLink} replied to your{' '}
            {notification.recipient && notification.postId ? (
              <ChakraLink as={RouterLink} to={`/${notification.recipient.username}/post/${notification.postId}`} fontWeight="bold" fontSize={{ base: "sm", md: "md" }}>
                comment
              </ChakraLink>
            ) : (
              <Text as="span" fontWeight="bold" fontSize={{ base: "sm", md: "md" }}>
                comment
              </Text>
            )}{' '}
            <span style={{ color: 'gray', fontSize: 'smaller' }}>({timeAgo})</span>
          </Text>
        );
      default:
        return (
          <Text color="white" bg="transparent" fontSize={{ base: "sm", md: "md" }}>
            Unknown notification type{' '}
            <span style={{ color: 'gray', fontSize: 'smaller' }}>({timeAgo})</span>
          </Text>
        );
    }
  };

  return (
    <Box
      className="page-content-scroll"
      bg="transparent"
      pt={{ base: "60px", md: "20px" }} // Adjusted padding for logo
    >
      {/* Notifications Header styled like Search page */}
      <Heading
        as="h1"
        size={{ base: "xl", md: "2xl" }}
        mb={{ base: 4, md: 8 }}
        textAlign="center"
        mt={{ base: 2, md: 0 }}
      >
        Notifications
      </Heading>

      <Box
        bg="transparent"
        pb={100} /* Padding to prevent content from being hidden behind the navigation bar */
      >
        <Box
          position="relative"
          w={["100%", "500px", "550px"]} /* Increased width */
          maxW="100%"
          mx="auto"
          display="flex"
          flexDirection="column"
          bg="#151515"
          borderRadius="2xl"
          boxShadow="none"
          borderTop="1px solid rgba(255, 255, 255, 0.06)"
          borderLeft="1px solid rgba(255, 255, 255, 0.06)"
          borderRight="1px solid rgba(255, 255, 255, 0.06)"
          borderBottom="none"
          overflow="hidden"
          px={0}
          zIndex={99}
          h={{ base: "70vh", md: "650px" }} /* Responsive height */
          p={5} /* Increased padding */
        >
          {/* Notifications list with inner scroll */}
          <Flex
            direction="column"
            gap={4} /* Increased gap */
            px={4}
            pb={6} /* Increased padding */
            pt={2}
            className="always-show-scrollbar"
            overflowY="scroll" /* Force scroll instead of auto */
            flexGrow={1}
            h="100%" /* Full height since heading was removed */
            css={{
              '&::-webkit-scrollbar': {
                width: '8px', /* Wider scrollbar */
                display: 'block', /* Always show scrollbar */
              },
              '&::-webkit-scrollbar-track': {
                background: '#1a1a1a', /* Slightly visible track */
                display: 'block', /* Always show track */
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(255, 255, 255, 0.3)', /* More visible thumb */
                borderRadius: '4px',
                minHeight: '30px', /* Ensure thumb is visible */
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: 'rgba(255, 255, 255, 0.5)', /* Even more visible on hover */
              },
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255, 255, 255, 0.3) #1a1a1a',
              /* Firefox specific */
              scrollbarGutter: 'stable',
            }}
          >
            {loading && (
              <Box
                bg="#1E1E1E" /* Darker background to match Search page */
                borderRadius="2xl"
                borderTop="1px solid rgba(255, 255, 255, 0.03)"
                borderLeft="1px solid rgba(255, 255, 255, 0.03)"
                borderRight="1px solid rgba(255, 255, 255, 0.03)"
                borderBottom="1px solid rgba(255, 255, 255, 0.03)"
                p={5} /* Increased padding */
                mb={4} /* Increased margin */
              >
                <Flex justify="center" py={4}> {/* Added vertical padding */}
                  <Spinner size="lg" color="whiteAlpha.700" /> {/* Larger spinner */}
                </Flex>
              </Box>
            )}

            {!loading && notifications.length === 0 && (
              <Box
                bg="#1E1E1E" /* Darker background to match Search page */
                borderRadius="2xl"
                borderTop="1px solid rgba(255, 255, 255, 0.03)"
                borderLeft="1px solid rgba(255, 255, 255, 0.03)"
                borderRight="1px solid rgba(255, 255, 255, 0.03)"
                borderBottom="1px solid rgba(255, 255, 255, 0.03)"
                p={5} /* Increased padding */
                mb={4} /* Increased margin */
              >
                <Text textAlign="center" color="whiteAlpha.700" fontSize="md" py={4}> {/* Larger text and added padding */}
                  You have no notifications yet.
                </Text>
              </Box>
            )}

            {!loading && notifications.length > 0 && notifications.filter(notification => notification && notification._id).map((notification, idx) => (
              <Box
                key={notification._id}
                ref={notifications.length === idx + 1 ? lastNotificationRef : null}
                bg="#1E1E1E" /* Darker background to match Search page */
                borderRadius="2xl"
                borderTop="1px solid rgba(255, 255, 255, 0.03)"
                borderLeft="1px solid rgba(255, 255, 255, 0.03)"
                borderRight="1px solid rgba(255, 255, 255, 0.03)"
                borderBottom="1px solid rgba(255, 255, 255, 0.03)"
                p={{ base: 3, md: 5 }} /* Responsive padding */
                _hover={{ bg: "rgba(255, 255, 255, 0.03)" }}
                transition="all 0.2s"
                mb={4} /* Increased margin */
              >
                <Flex gap={{ base: 3, md: 4 }} align="flex-start">
                  {notification.sender ? (
                    <ChakraLink as={RouterLink} to={`/${notification.sender.username}`}>
                      <Avatar
                        src={notification.sender.profilePic}
                        size={{ base: "md", md: "lg" }} /* Responsive avatar size */
                        borderRadius="full"
                        border="2px solid"
                        borderColor="whiteAlpha.200"
                      />
                    </ChakraLink>
                  ) : (
                    <Avatar
                      size={{ base: "md", md: "lg" }} /* Responsive avatar size */
                      borderRadius="full"
                      border="2px solid"
                      borderColor="whiteAlpha.200"
                    />
                  )}
                  <Box
                    flex="1"
                    bg="transparent"
                    p={{ base: 2, md: 4 }} /* Responsive padding */
                    borderRadius="xl"
                    fontSize={{ base: "sm", md: "md" }} /* Responsive text size */
                  >
                    {renderNotificationText(notification)}
                  </Box>
                  {/* Unread indicator */}
                  {!notification.read && (
                    <Box w={3} h={3} bg="blue.400" borderRadius="full" mt={2} /> /* Larger indicator */
                  )}
                  {/* Three dots menu for notification actions */}
                  <Menu placement="bottom-end" isLazy>
                    <MenuButton
                      as={IconButton}
                      icon={<BsThreeDotsVertical />}
                      variant="ghost"
                      size="md" /* Larger button */
                      color="whiteAlpha.700"
                      _hover={{
                        bg: "rgba(0, 204, 133, 0.1)" /* Match Search page hover style */
                      }}
                    />
                    <MenuList
                      bg="#1E1E1E" /* Darker background to match Search page */
                      borderColor="whiteAlpha.200"
                      boxShadow="lg"
                      p={2} /* Added padding */
                    >
                      <MenuItem
                        icon={<FaTrash />}
                        color="red.400"
                        bg="transparent"
                        fontSize="md" /* Larger text */
                        p={3} /* Increased padding */
                        borderRadius="md" /* Rounded corners */
                        _hover={{
                          bg: "rgba(0, 204, 133, 0.1)" /* Match Search page hover style */
                        }}
                        onClick={() => handleDeleteNotification(notification._id)}
                      >
                        Delete notification
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </Flex>
              </Box>
            ))}

            {/* Add padding at the bottom for spacing */}
            <Box h="30px"></Box>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
};

export default NotificationsPage;
