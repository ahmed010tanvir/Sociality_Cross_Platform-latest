/**
 * Socket event handlers
 * Centralized handlers for socket events
 */

/**
 * Handle new message event
 * @param {object} data - Message data
 * @param {function} updateMessages - Function to update messages state
 * @param {function} showToast - Function to show toast notification
 */
export const handleNewMessage = (data, updateMessages, showToast) => {
  // Update messages in state
  updateMessages(prev => {
    // Check if conversation exists
    const conversationExists = prev.some(
      conversation => conversation.participants.includes(data.sender)
    );

    // If conversation exists, add message to it
    if (conversationExists) {
      return prev.map(conversation => {
        if (conversation.participants.includes(data.sender)) {
          return {
            ...conversation,
            messages: [...conversation.messages, data],
            lastMessage: data
          };
        }
        return conversation;
      });
    }

    // If conversation doesn't exist, create a new one
    return [
      ...prev,
      {
        participants: [data.sender],
        messages: [data],
        lastMessage: data
      }
    ];
  });

  // Show toast notification
  if (showToast) {
    showToast(
      "New Message",
      `You have a new message from ${data.senderName}`,
      "info"
    );
  }
};

/**
 * Handle new notification event
 * @param {object} data - Notification data
 * @param {function} updateNotifications - Function to update notifications state
 * @param {function} showToast - Function to show toast notification
 */
export const handleNewNotification = (data, updateNotifications, showToast) => {
  // Update notifications in state
  updateNotifications(prev => [data, ...prev]);

  // Show toast notification
  if (showToast) {
    showToast(
      "New Notification",
      data.message,
      "info"
    );
  }
};

/**
 * Handle post update event
 * @param {object} data - Post update data
 * @param {function} updatePosts - Function to update posts state
 */
export const handlePostUpdate = (data, updatePosts) => {
  if (!data || !data.postId) return;

  // Handle different types of post updates
  switch (data.type) {
    case 'like':
      updatePosts(prev => 
        prev.map(post => 
          post._id === data.postId 
            ? { ...post, likes: data.likes } 
            : post
        )
      );
      break;
    
    case 'comment':
      updatePosts(prev => 
        prev.map(post => 
          post._id === data.postId 
            ? { ...post, replies: [...(post.replies || []), data.comment] } 
            : post
        )
      );
      break;
    
    case 'delete':
      updatePosts(prev => prev.filter(post => post._id !== data.postId));
      break;
    
    default:
      console.log('Unknown post update type:', data.type);
  }
};

/**
 * Handle user status change event
 * @param {object} data - User status data
 * @param {function} updateOnlineUsers - Function to update online users state
 */
export const handleUserStatusChange = (data, updateOnlineUsers) => {
  if (data.online) {
    // Add user to online users
    updateOnlineUsers(prev => [...prev, data.userId]);
  } else {
    // Remove user from online users
    updateOnlineUsers(prev => prev.filter(id => id !== data.userId));
  }
};
