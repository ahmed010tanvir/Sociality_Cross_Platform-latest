import Conversation from "../models/conversationModel.js";
import Message from "../models/messageModel.js";
import { getRecipientSocketId, io, sendMessageToUser } from "../socket/socket.js";
import { v2 as cloudinary } from "cloudinary";

async function sendMessage(req, res) {
	try {
		const { recipientId, text, tempId } = req.body;
		let img = req.body.img;
		let gif = req.body.gif;
		let voice = req.body.voice;
		let file = req.body.file;
		let fileName = req.body.fileName;
		let fileSize = req.body.fileSize;
		let emoji = req.body.emoji;
		let voiceDuration = req.body.voiceDuration || req.body.duration;
		const senderId = req.user._id;

		console.log(`Processing message via REST API (tempId: ${tempId || 'none'})`);

		// Check if a message with this tempId already exists (from socket.io)
		if (tempId) {
			const existingMessage = await Message.findOne({ tempId });
			if (existingMessage) {
				console.log(`Message with tempId ${tempId} already exists, updating with media`);
				if (img) {
					const uploadedResponse = await cloudinary.uploader.upload(img);
					existingMessage.img = uploadedResponse.secure_url;
				}
				if (voice && voice.startsWith('data:')) {
					const uploadedResponse = await cloudinary.uploader.upload(voice, {
						resource_type: "auto"
					});
					existingMessage.voice = uploadedResponse.secure_url;
				}
				if (file && file.startsWith('data:')) {
					const uploadedResponse = await cloudinary.uploader.upload(file, {
						resource_type: "auto"
					});
					existingMessage.file = uploadedResponse.secure_url;
				}
				await existingMessage.save();
				sendMessageToUser(recipientId, "newMessage", existingMessage);
				sendMessageToUser(senderId, "newMessage", existingMessage);
				return res.status(200).json(existingMessage);
			}
		}

		// Handle multipart (FormData) uploads
		if (req.files) {
			if (req.files.img && req.files.img[0]) {
				const upload = await cloudinary.uploader.upload(req.files.img[0].path);
				img = upload.secure_url;
			}
			if (req.files.gif && req.files.gif[0]) {
				const upload = await cloudinary.uploader.upload(req.files.gif[0].path);
				gif = upload.secure_url;
			}
			if (req.files.voice && req.files.voice[0]) {
				const upload = await cloudinary.uploader.upload(req.files.voice[0].path, { resource_type: 'auto' });
				voice = upload.secure_url;
			}
			if (req.files.file && req.files.file[0]) {
				const upload = await cloudinary.uploader.upload(req.files.file[0].path, { resource_type: 'auto' });
				file = upload.secure_url;
			}
		}

		let conversation = await Conversation.findOne({
			participants: { $all: [senderId, recipientId] },
		});
		if (!conversation) {
			conversation = new Conversation({
				participants: [senderId, recipientId],
				lastMessage: {
					text: text,
					sender: senderId,
				},
			});
			await conversation.save();
		}
		if (img && typeof img === 'string' && img.startsWith('data:')) {
			const uploadedResponse = await cloudinary.uploader.upload(img);
			img = uploadedResponse.secure_url;
		}
		if (gif && typeof gif === 'string' && gif.startsWith('data:')) {
			const uploadedResponse = await cloudinary.uploader.upload(gif);
			gif = uploadedResponse.secure_url;
		}
		if (voice && typeof voice === 'string' && voice.startsWith('data:')) {
			const uploadedResponse = await cloudinary.uploader.upload(voice, {
				resource_type: "auto"
			});
			voice = uploadedResponse.secure_url;
		}
		if (file && typeof file === 'string' && file.startsWith('data:')) {
			const uploadedResponse = await cloudinary.uploader.upload(file, {
				resource_type: "auto"
			});
			file = uploadedResponse.secure_url;
		}
		if (( !text || text.trim() === '' ) && !img && !gif && !voice && !file && !emoji ) {
			return res.status(400).json({ error: 'Cannot send empty message.' });
		}
		const newMessage = new Message({
			conversationId: conversation._id,
			sender: senderId,
			text: text || "",
			img: img || "",
			gif: gif || "",
			voice: voice || "",
			voiceDuration: voiceDuration || 0,
			file: file || "",
			fileName: fileName || "",
			fileSize: fileSize || 0,
			emoji: emoji || "",
			deletedFor: [],
			deletedForEveryone: false,
			tempId: tempId || undefined,
		});
		await newMessage.save();
		conversation.lastMessage = {
			text: text,
			sender: senderId,
			seen: false,
		};
		await conversation.save();
		sendMessageToUser(recipientId, "newMessage", newMessage);
		sendMessageToUser(senderId, "newMessage", newMessage);
		return res.status(201).json(newMessage);
	} catch (error) {
		console.error("Error in sendMessage:", error);
		return res.status(500).json({ error: "Failed to send message." });
	}
}

async function getMessages(req, res) {
	const { otherUserId } = req.params;
	const userId = req.user._id;
	const since = req.query.since;

	try {
		const conversation = await Conversation.findOne({
			participants: { $all: [userId, otherUserId] },
		});

		if (!conversation) {
			return res.status(404).json({ error: "Conversation not found" });
		}

		const query = {
			conversationId: conversation._id,
			deletedFor: { $ne: userId },
		};

		if (since) {
			query.createdAt = { $gt: new Date(since) };
		}

		const messages = await Message.find(query).sort({ createdAt: 1 });

		if (since && messages.length > 0) {
			console.log(`Found ${messages.length} new messages for conversation ${conversation._id}`);
		}

		res.status(200).json(messages);
	} catch (error) {
		console.error("Error fetching messages:", error);
		res.status(500).json({ error: error.message });
	}
}

async function getConversations(req, res) {
	if (!req.user || !req.user._id) {
		return res.status(401).json({ error: "Unauthorized: user not authenticated" });
	}
	const userId = req.user._id;
	try {
		const conversations = await Conversation.find({ participants: userId }).populate({
			path: "participants",
			select: "username profilePic",
		});

		// remove the current user from the participants array
		conversations.forEach((conversation) => {
			conversation.participants = conversation.participants.filter(
				(participant) => participant._id.toString() !== userId.toString()
			);
		});
		res.status(200).json(conversations);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
}

async function deleteMessage(req, res) {
	const { messageId } = req.params;
	const { deleteForEveryone } = req.body;
	const userId = req.user._id;

	try {
		const message = await Message.findById(messageId);

		if (!message) {
			return res.status(404).json({ error: "Message not found" });
		}

		// Check if this is the user's message
		const isOwnMessage = message.sender.toString() === userId.toString();

		if (deleteForEveryone) {
			// Only message sender can delete for everyone
			if (!isOwnMessage) {
				return res.status(403).json({ error: "You can only delete your own messages for everyone" });
			}

			// Mark as deleted for everyone
			message.deletedForEveryone = true;

			// Notify other user about message deletion
			const conversation = await Conversation.findById(message.conversationId);
			if (conversation) {
				const recipientId = conversation.participants.find(
					(participant) => participant.toString() !== userId.toString()
				);

				if (recipientId) {
					// Use the new sendMessageToUser function
					sendMessageToUser(recipientId, "messageDeleted", {
						messageId: message._id,
						deleteForEveryone: true
					});
				}
			}
		} else {
			// Delete just for this user
			if (!message.deletedFor.includes(userId)) {
				message.deletedFor.push(userId);
			}
		}

		await message.save();

		res.status(200).json({ message: "Message deleted successfully" });
	} catch (error) {
		console.error("Error deleting message:", error);
		res.status(500).json({ error: error.message });
	}
}

export { sendMessage, getMessages, getConversations, deleteMessage };
