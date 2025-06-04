import User from "../models/userModel.js";
import Post from "../models/postModel.js";
import bcrypt from "bcryptjs";
import generateTokenAndSetCookie from "../utils/helpers/generateTokenAndSetCookie.js";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import Notification from "../models/notificationModel.js"; // Import Notification model
import Message from "../models/messageModel.js"; // Import Message model
import Conversation from "../models/conversationModel.js"; // Import Conversation model
import logger from "../utils/logger.js";

const getUserProfile = async (req, res) => {
	// We will fetch user profile either with username or userId
	// query is either username or userId
	const { query } = req.params;

	try {
		let user;

		// query is userId
		if (mongoose.Types.ObjectId.isValid(query)) {
			user = await User.findOne({ _id: query })
				.select("-password -updatedAt")
				.populate("followers", "_id username name profilePic")
				.populate("following", "_id username name profilePic");
		} else {
			// query is username
			user = await User.findOne({ username: query })
				.select("-password -updatedAt")
				.populate("followers", "_id username name profilePic")
				.populate("following", "_id username name profilePic");
		}

		if (!user) return res.status(404).json({ error: "User not found" });

		res.status(200).json(user);
	} catch (err) {
		res.status(500).json({ error: err.message });
		logger.error("Error in getUserProfile", err);
	}
};

const signupUser = async (req, res) => {
	try {
		const { name, email, username, password } = req.body;
		const user = await User.findOne({ $or: [{ email }, { username }] });

		if (user) {
			return res.status(400).json({ error: "User already exists" });
		}
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);

		const newUser = new User({
			name,
			email,
			username,
			password: hashedPassword
		});
		await newUser.save();

		if (newUser) {
			generateTokenAndSetCookie(newUser._id, res);

			res.status(201).json({
				_id: newUser._id,
				name: newUser.name,
				email: newUser.email,
				username: newUser.username,
				bio: newUser.bio,
				profilePic: newUser.profilePic
			});
		} else {
			res.status(400).json({ error: "Invalid user data" });
		}
	} catch (err) {
		res.status(500).json({ error: err.message });
		logger.error("Error in signupUser", err);
	}
};

const loginUser = async (req, res) => {
	try {
		const { username, password } = req.body;
		const user = await User.findOne({ username });
		const isPasswordCorrect = await bcrypt.compare(password, user?.password || "");

		if (!user || !isPasswordCorrect) return res.status(400).json({ error: "Invalid username or password" });

		if (user.isFrozen) {
			user.isFrozen = false;
			await user.save();
		}



		generateTokenAndSetCookie(user._id, res);

		res.status(200).json({
			_id: user._id,
			name: user.name,
			email: user.email,
			username: user.username,
			bio: user.bio,
			profilePic: user.profilePic
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
		logger.error("Error in loginUser", error);
	}
};

const logoutUser = (req, res) => {
	try {
		// Clear all possible JWT cookies for multi-tab support
		res.cookie("jwt", "", { maxAge: 1 });
		res.cookie("jwt-sociality", "", { maxAge: 1 });

		// Clear session-specific cookie if session path is provided
		const sessionPath = req.query.session || '';
		if (sessionPath) {
			const cookieName = `jwt-sociality${sessionPath.replace(/\//g, '-')}`;
			res.cookie(cookieName, "", { maxAge: 1 });
		}

		res.status(200).json({ message: "User logged out successfully" });
	} catch (err) {
		res.status(500).json({ error: err.message });
		logger.error("Error in logoutUser", err);
	}
};

const followUnFollowUser = async (req, res) => {
	try {
		const { id } = req.params;
		const userToModify = await User.findById(id);
		const currentUser = await User.findById(req.user._id);

		if (id === req.user._id.toString())
			return res.status(400).json({ error: "You cannot follow/unfollow yourself" });

		if (!userToModify || !currentUser) return res.status(400).json({ error: "User not found" });

		// Check if current user is following the target user
		const isFollowing = currentUser.following.some(followingId =>
			followingId.toString() === id.toString()
		);

		if (isFollowing) {
			// Unfollow user
			await User.findByIdAndUpdate(id, { $pull: { followers: req.user._id } });
			await User.findByIdAndUpdate(req.user._id, { $pull: { following: id } });
			res.status(200).json({ message: "User unfollowed successfully" });
		} else {
			// Follow user
			await User.findByIdAndUpdate(id, { $push: { followers: req.user._id } });
			await User.findByIdAndUpdate(req.user._id, { $push: { following: id } });

			// Create follow notification
			const newNotification = new Notification({
				recipient: id, // The user being followed
				sender: req.user._id, // The user who followed
				type: "follow",
			});
			await newNotification.save();
			// Note: We don't wait for the notification save to send the response for faster UX

			res.status(200).json({ message: "User followed successfully" });
		}
	} catch (err) {
		res.status(500).json({ error: err.message });
		logger.error("Error in followUnFollowUser", err);
	}
};

const updateUser = async (req, res) => {
	const { name, email, username, password, bio } = req.body;
	let { profilePic } = req.body;

	const userId = req.user._id;
	try {
		let user = await User.findById(userId);
		if (!user) return res.status(400).json({ error: "User not found" });

		if (req.params.id !== userId.toString())
			return res.status(400).json({ error: "You cannot update other user's profile" });

		if (password) {
			const salt = await bcrypt.genSalt(10);
			const hashedPassword = await bcrypt.hash(password, salt);
			user.password = hashedPassword;
		}

		if (profilePic) {
			if (user.profilePic) {
				await cloudinary.uploader.destroy(user.profilePic.split("/").pop().split(".")[0]);
			}

			// Check if profilePic is a base64 string
			if (profilePic.startsWith('data:image')) {
				try {
					const uploadedResponse = await cloudinary.uploader.upload(profilePic, {
						resource_type: "auto"
					});
					profilePic = uploadedResponse.secure_url;
				} catch (err) {
					logger.error("Error uploading to Cloudinary", err);
					return res.status(500).json({ error: "Error uploading image" });
				}
			} else if (!profilePic.startsWith('http')) {
				return res.status(400).json({ error: "Invalid image URL" });
			}
		}

		user.name = name || user.name;
		user.email = email || user.email;
		user.username = username || user.username;
		user.profilePic = profilePic || user.profilePic;
		user.bio = bio || user.bio;

		user = await user.save();

		// Find all posts that this user replied and update username and userProfilePic fields
		await Post.updateMany(
			{ "replies.userId": userId },
			{
				$set: {
					"replies.$[reply].username": user.username,
					"replies.$[reply].userProfilePic": user.profilePic,
				},
			},
			{ arrayFilters: [{ "reply.userId": userId }] }
		);

		// password should be null in response
		user.password = null;

		res.status(200).json(user);
	} catch (err) {
		res.status(500).json({ error: err.message });
		logger.error("Error in updateUser", err);
	}
};

const getSuggestedUsers = async (req, res) => {
    try {
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "Invalid userId" });
        }

        // Get the current user to access their following list
        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.status(404).json({ error: "User not found" });
        }

        // Convert following array to ObjectIds
        const followingIds = currentUser.following.map(id => new mongoose.Types.ObjectId(id));

        // Match stage: exclude current user, users the current user is following, and users following the current user
        const matchStage = {
            $match: {
                $and: [
                    { _id: { $ne: new mongoose.Types.ObjectId(userId) } },  // Not the current user
                    { _id: { $nin: followingIds } },                        // Not users the current user is following
                    { followers: { $ne: new mongoose.Types.ObjectId(userId) } } // Not users following the current user
                ]
            }
        };

        const lookupStage = {
            $lookup: {
                from: 'posts',
                localField: '_id',
                foreignField: 'postedBy',
                as: 'userPosts'
            }
        };
        const projectStage = {
            $project: {
                _id: 1,
                username: 1,
                profilePic: 1,
                name: 1,
                postsCount: { $size: '$userPosts' }
            }
        };
        const sortStage = { $sort: { postsCount: -1 } };
        const limitStage = { $limit: 5 };

        const popularUsers = await User.aggregate([
            matchStage,
            lookupStage,
            projectStage,
            sortStage,
            limitStage
        ]);

        res.status(200).json(popularUsers);
    } catch (error) {
        logger.error("Error in getSuggestedUsers", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


const freezeAccount = async (req, res) => {
	try {
		const user = await User.findById(req.user._id);
		if (!user) {
			return res.status(400).json({ error: "User not found" });
		}

		user.isFrozen = true;
		await user.save();

		res.status(200).json({ success: true });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// New function to search users
const searchUsers = async (req, res) => {
	const { query } = req.query; // Get search query from query parameters
	const userId = req.user._id; // Get current user ID from protectRoute middleware

	if (!query) {
		return res.status(400).json({ error: "Search query is required" });
	}

	try {
		// Get the current user to access their following list
		const currentUser = await User.findById(userId);
		if (!currentUser) {
			return res.status(404).json({ error: "User not found" });
		}

		// Use a regex for case-insensitive search on username or name
		const users = await User.find({
			$and: [
				{
					$or: [
						{ username: { $regex: query, $options: "i" } }, // Case-insensitive regex search on username
						{ name: { $regex: query, $options: "i" } },     // Case-insensitive regex search on name
					],
				},
				{ _id: { $ne: userId } }, // Exclude current user
			],
		}).select("-password"); // Exclude password from results

		res.status(200).json(users);
	} catch (error) {
		res.status(500).json({ error: error.message });
		logger.error("Error in searchUsers", error);
	}
};

// Function to reset a user's following list
const resetFollowing = async (req, res) => {
	try {
		const userId = req.user._id;

		// Get the current user
		const currentUser = await User.findById(userId);
		if (!currentUser) {
			return res.status(404).json({ error: "User not found" });
		}

		// For each user that the current user is following, remove the current user from their followers
		for (const followingId of currentUser.following) {
			await User.findByIdAndUpdate(followingId, {
				$pull: { followers: userId }
			});
		}

		// Clear the current user's following list
		currentUser.following = [];
		await currentUser.save();

		// Get the updated user with populated fields
		const updatedUser = await User.findById(userId)
			.select("-password -updatedAt")
			.populate("followers", "_id username name profilePic")
			.populate("following", "_id username name profilePic");

		res.status(200).json(updatedUser);
	} catch (err) {
		res.status(500).json({ error: err.message });
		logger.error("Error in resetFollowing", err);
	}
};


// Delete user account permanently
const deleteAccount = async (req, res) => {
	try {
		const userId = req.user._id;
		const user = await User.findById(userId);

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Delete user's posts
		await Post.deleteMany({ postedBy: userId });

		// Remove user from followers' following lists
		await User.updateMany(
			{ followers: userId },
			{ $pull: { followers: userId } }
		);

		// Remove user from following users' followers lists
		await User.updateMany(
			{ following: userId },
			{ $pull: { following: userId } }
		);

		// Delete user's notifications
		await Notification.deleteMany({
			$or: [
				{ recipient: userId },
				{ sender: userId }
			]
		});

		// Find all conversations involving the user
		const conversations = await Conversation.find({
			participants: userId
		});

		// Get conversation IDs
		const conversationIds = conversations.map(conv => conv._id);

		// Delete all messages in those conversations
		await Message.deleteMany({
			conversationId: { $in: conversationIds }
		});

		// Delete all conversations involving the user
		await Conversation.deleteMany({
			participants: userId
		});

		// Delete the user
		await User.findByIdAndDelete(userId);

		// Clear the JWT cookie
		res.cookie("jwt", "", { maxAge: 1 });

		res.status(200).json({ success: true, message: "Account deleted successfully" });
	} catch (error) {
		res.status(500).json({ error: error.message });
		logger.error("Error in deleteAccount", error);
	}
};

const checkProfileCompletion = async (req, res) => {
	try {
		const userId = req.user._id;
		const user = await User.findById(userId).select("isProfileComplete name username bio profilePic googleId isGoogleUser email createdAt");

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Smart profile completion detection
		let isActuallyComplete = user.isProfileComplete;

		// Define what constitutes a complete profile
		const hasRequiredFields = user.name && user.username && user.email;

		// For Google OAuth users, if they exist in the system, they should be considered complete
		// Profile setup is only for brand new Google OAuth users
		if (user.isGoogleUser) {
			// If this is an existing Google OAuth user, mark as complete
			if (hasRequiredFields && !isActuallyComplete) {
				isActuallyComplete = true;
				await User.findByIdAndUpdate(userId, { isProfileComplete: true });
				console.log(`Updated existing Google OAuth user profile completion status: ${user.username}`);
			}
		} else {
			// For non-Google users, if they have required fields, consider complete
			if (!isActuallyComplete && hasRequiredFields) {
				isActuallyComplete = true;
				await User.findByIdAndUpdate(userId, { isProfileComplete: true });
				console.log(`Updated regular user profile completion status: ${user.username}`);
			}
		}

		res.status(200).json({
			isProfileComplete: isActuallyComplete,
			profile: {
				name: user.name,
				username: user.username,
				bio: user.bio,
				profilePic: user.profilePic,
				isGoogleUser: user.isGoogleUser
			}
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
		logger.error("Error in checkProfileCompletion", error);
	}
};

const completeProfile = async (req, res) => {
	try {
		console.log("=== PROFILE COMPLETION REQUEST ===");
		console.log("User from req.user:", req.user ? {
			id: req.user._id,
			username: req.user.username,
			email: req.user.email,
			isProfileComplete: req.user.isProfileComplete,
			isGoogleUser: req.user.isGoogleUser
		} : 'null');
		console.log("Request body:", req.body);
		console.log("Session path from query:", req.query.session);
		console.log("Request headers:", req.headers.cookie ? 'Cookies present' : 'No cookies');

		const userId = req.user._id;
		let { name, username, bio, profilePic } = req.body;

		console.log("Profile completion request:", {
			userId,
			name,
			username,
			bio: bio ? bio.substring(0, 50) + "..." : "",
			hasProfilePic: !!profilePic
		});

		// Validate required fields
		if (!name || !username) {
			return res.status(400).json({ error: "Name and username are required" });
		}

		// Validate username format
		if (!/^[a-zA-Z0-9_]+$/.test(username)) {
			return res.status(400).json({ error: "Username can only contain letters, numbers, and underscores" });
		}

		// Check if username is already taken by another user
		const existingUser = await User.findOne({
			username: username.trim(),
			_id: { $ne: userId }
		});

		if (existingUser) {
			return res.status(400).json({ error: "Username is already taken" });
		}

		// Handle profile picture upload if provided
		if (profilePic && profilePic.startsWith('data:image')) {
			try {
				const uploadedResponse = await cloudinary.uploader.upload(profilePic, {
					resource_type: "auto",
					folder: "profile_pics"
				});
				profilePic = uploadedResponse.secure_url;
			} catch (uploadError) {
				logger.error("Error uploading profile picture to Cloudinary", uploadError);
				return res.status(500).json({ error: "Error uploading profile picture" });
			}
		}

		// Update user profile
		const updatedUser = await User.findByIdAndUpdate(
			userId,
			{
				name: name.trim(),
				username: username.trim(),
				bio: bio ? bio.trim() : "",
				profilePic: profilePic || "",
				isProfileComplete: true
			},
			{ new: true }
		).select("-password");

		if (!updatedUser) {
			return res.status(404).json({ error: "User not found" });
		}

		// Get session path from query to include in response
		const sessionPath = req.query.session || '';

		console.log("=== PROFILE COMPLETION SUCCESS ===");
		console.log("Updated user:", {
			id: updatedUser._id,
			username: updatedUser.username,
			isProfileComplete: updatedUser.isProfileComplete
		});
		console.log("Returning session path:", sessionPath);

		// Ensure we return a proper JSON response
		res.status(200).json({
			_id: updatedUser._id,
			name: updatedUser.name,
			email: updatedUser.email,
			username: updatedUser.username,
			bio: updatedUser.bio,
			profilePic: updatedUser.profilePic,
			isProfileComplete: updatedUser.isProfileComplete,
			followers: updatedUser.followers,
			following: updatedUser.following,
			isFrozen: updatedUser.isFrozen,
			googleId: updatedUser.googleId,
			isGoogleUser: updatedUser.isGoogleUser,
			createdAt: updatedUser.createdAt,
			updatedAt: updatedUser.updatedAt,
			sessionPath: sessionPath // Include session path in response
		});
	} catch (error) {
		logger.error("Error in completeProfile", error);
		res.status(500).json({ error: error.message });
	}
};

export {
	signupUser,
	loginUser,
	logoutUser,
	followUnFollowUser,
	updateUser,
	getUserProfile,
	getSuggestedUsers,
	freezeAccount,
	searchUsers,
	resetFollowing,
	deleteAccount,
	completeProfile,
	checkProfileCompletion,
};
