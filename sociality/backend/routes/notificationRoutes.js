import express from "express";
import protectRoute from "../middlewares/protectRoute.js";
import {
    getNotifications,
    deleteNotification,
    deleteNotificationsByPostAndType,
    markNotificationAsRead
} from "../controllers/notificationController.js";

const router = express.Router();

// Route to get notifications for the logged-in user
router.get("/", protectRoute, getNotifications);

// Route to delete a specific notification
router.delete("/:id", protectRoute, deleteNotification);

// Route to delete all notifications of a specific type for a post
router.delete("/post/:postId/type/:type", protectRoute, deleteNotificationsByPostAndType);

// Route to mark a notification as read
router.put("/read/:id", protectRoute, markNotificationAsRead);

export default router;
