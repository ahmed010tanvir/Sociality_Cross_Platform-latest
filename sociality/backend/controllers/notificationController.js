import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js"; // Needed for populating sender info
import logger from "../utils/logger.js";

// Get notifications for the logged-in user
const getNotifications = async (req, res) => {
    if (!req.user || !req.user._id) {
        return res.status(401).json({ error: "Unauthorized: user not authenticated" });
    }
    try {
        const userId = req.user._id; // Get user ID from protectRoute middleware
        const page = parseInt(req.query.page) || 1; // Get page from query params, default to 1
        const limit = parseInt(req.query.limit) || 10; // Get limit from query params, default to 10
        const skip = (page - 1) * limit; // Calculate how many documents to skip

        // Get total count for pagination info
        const totalCount = await Notification.countDocuments({ recipient: userId });

        // Get paginated notifications
        const notifications = await Notification.find({ recipient: userId })
            .sort({ createdAt: -1 }) // Sort by newest first
            .skip(skip)
            .limit(limit)
            .populate({
                path: "sender",
                select: "username profilePic", // Select sender details
            })
            .populate({
                path: "recipient", // Also populate recipient
                select: "username", // Select recipient's username for link construction
            });

        // Optionally, mark fetched notifications as read here or provide a separate endpoint
        // await Notification.updateMany({ recipient: userId, read: false }, { read: true });

        // Calculate if there are more pages
        const hasMore = totalCount > skip + notifications.length;

        res.status(200).json({
            notifications,
            hasMore,
            totalCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
        logger.error("Error in getNotifications", error);
    }
};

// Delete a notification
const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        // Find the notification
        const notification = await Notification.findById(id);

        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        // Check if the user is the recipient of the notification
        if (notification.recipient.toString() !== userId.toString()) {
            return res.status(403).json({ error: "You can only delete your own notifications" });
        }

        // Delete the notification
        await Notification.findByIdAndDelete(id);

        res.status(200).json({ message: "Notification deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
        logger.error("Error in deleteNotification", error);
    }
};

// Delete all notifications of a specific type for a post
const deleteNotificationsByPostAndType = async (req, res) => {
    try {
        const { postId, type } = req.params;
        const userId = req.user._id;

        // Delete all notifications of the specified type for the post
        const result = await Notification.deleteMany({
            recipient: userId,
            postId: postId,
            type: type
        });

        res.status(200).json({
            message: `${result.deletedCount} notifications deleted successfully`,
            count: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
        logger.error("Error in deleteNotificationsByPostAndType", error);
    }
};

// Mark a notification as read
const markNotificationAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        // Find the notification
        const notification = await Notification.findById(id);

        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        // Check if the user is the recipient of the notification
        if (notification.recipient.toString() !== userId.toString()) {
            return res.status(403).json({ error: "You can only mark your own notifications as read" });
        }

        // Mark the notification as read
        notification.read = true;
        await notification.save();

        res.status(200).json({ message: "Notification marked as read" });
    } catch (error) {
        res.status(500).json({ error: error.message });
        logger.error("Error in markNotificationAsRead", error);
    }
};

export {
    getNotifications,
    deleteNotification,
    deleteNotificationsByPostAndType,
    markNotificationAsRead
};
