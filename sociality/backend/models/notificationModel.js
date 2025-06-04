import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
	{
		recipient: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		sender: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		type: {
			type: String,
			required: true,
			enum: ["follow", "like", "comment", "reply"], // Define possible notification types
		},
		postId: { // Optional: ID of the post related to the notification (for likes/comments)
			type: mongoose.Schema.Types.ObjectId,
			ref: "Post",
		},
		read: {
			type: Boolean,
			default: false, // Notifications are unread by default
		},
	},
	{ timestamps: true } // Automatically add createdAt and updatedAt timestamps
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
