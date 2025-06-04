import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
	{
		conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
		sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		text: String,
		seen: {
			type: Boolean,
			default: false,
		},
		img: {
			type: String,
			default: "",
		},
		gif: {
			type: String,
			default: "",
		},
		voice: {
			type: String,
			default: "",
		},
		voiceDuration: {
			type: Number,
			default: 0,
		},
		file: {
			type: String,
			default: "",
		},
		fileName: {
			type: String,
			default: "",
		},
		fileSize: {
			type: Number,
			default: 0,
		},
		emoji: {
			type: String,
			default: "",
		},
		deletedFor: [{
			type: mongoose.Schema.Types.ObjectId,
			ref: "User"
		}],
		deletedForEveryone: {
			type: Boolean,
			default: false
		},
		tempId: {
			type: String,
			index: true // Add index for faster lookups
		},

	},
	{ timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
