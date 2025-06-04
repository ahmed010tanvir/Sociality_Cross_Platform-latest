import Post from "../models/postModel.js";
import User from "../models/userModel.js";
import Notification from "../models/notificationModel.js"; // Import Notification model
import { v2 as cloudinary } from "cloudinary";
import logger from "../utils/logger.js";
import { broadcastPostUpdate, sendMessageToUser } from "../socket/socket.js";

const createPost = async (req, res) => {
	try {
		const { postedBy, text } = req.body;
		let { img } = req.body;
		let { images } = req.body;

		if (!postedBy) {
			return res.status(400).json({ error: "PostedBy field is required" });
		}

		// Check if we have either text, a single image, or multiple images
		const hasImages = Array.isArray(images) && images.length > 0;

		// Allow empty text if any image is provided
		if (!text && !img && !hasImages) {
			return res.status(400).json({ error: "Either text or at least one image is required for a post" });
		}

		const user = await User.findById(postedBy);
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		if (user._id.toString() !== req.user._id.toString()) {
			return res.status(401).json({ error: "Unauthorized to create post" });
		}

		const maxLength = 500;
		if (text && text.length > maxLength) {
			return res.status(400).json({ error: `Text must be less than ${maxLength} characters` });
		}

		// Process single image (for backward compatibility)
		if (img) {
			const uploadedResponse = await cloudinary.uploader.upload(img);
			img = uploadedResponse.secure_url;
		}

		// Process multiple images if provided
		const uploadedImages = [];
		if (hasImages) {
			// Upload each image to Cloudinary
			for (const imageData of images) {
				try {
					const uploadedResponse = await cloudinary.uploader.upload(imageData);
					uploadedImages.push(uploadedResponse.secure_url);
				} catch (error) {
					logger.error("Error uploading image to Cloudinary", error);
					// Continue with other images if one fails
				}
			}
		}

		// If we have a single image but no multiple images, use the single image
		if (img && !hasImages) {
			uploadedImages.push(img);
		}

		// Create the post with all data
		const newPost = new Post({
			postedBy,
			text,
			img: uploadedImages.length > 0 ? uploadedImages[0] : null, // Set first image as main image
			images: uploadedImages
		});

		await newPost.save();

		// Populate postedBy field in the response
		const populatedPost = await Post.findById(newPost._id).populate("postedBy", "username profilePic");

		res.status(201).json(populatedPost);
	} catch (err) {
		res.status(500).json({ error: err.message });
		logger.error("Error in createPost", err);
	}
};

const getPost = async (req, res) => {
	try {
		// Populate postedBy field with username and profilePic
		const post = await Post.findById(req.params.id).populate("postedBy", "username profilePic");

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		// We'll let the frontend handle the sorting based on the user's context
		// This allows for temporary highlighting of new replies without changing the default sort

		res.status(200).json(post);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

const deletePost = async (req, res) => {
	try {
		const post = await Post.findById(req.params.id);
		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		if (post.postedBy.toString() !== req.user._id.toString()) {
			return res.status(401).json({ error: "Unauthorized to delete post" });
		}

		// Delete main image if it exists
		if (post.img) {
			const imgId = post.img.split("/").pop().split(".")[0];
			await cloudinary.uploader.destroy(imgId);
		}

		// Delete all images in the images array
		if (post.images && post.images.length > 0) {
			for (const imageUrl of post.images) {
				try {
					const imgId = imageUrl.split("/").pop().split(".")[0];
					await cloudinary.uploader.destroy(imgId);
				} catch (error) {
					logger.error("Error deleting image from Cloudinary", error);
					// Continue with other images if one fails
				}
			}
		}

		await Post.findByIdAndDelete(req.params.id);

		res.status(200).json({ message: "Post deleted successfully" });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

const updatePost = async (req, res) => {
try {
	const { text } = req.body;
	let { img } = req.body;
	let { images } = req.body;
	const postId = req.params.id;

	const post = await Post.findById(postId);
	if (!post) {
		return res.status(404).json({ error: "Post not found" });
	}

	if (post.postedBy.toString() !== req.user._id.toString()) {
		return res.status(401).json({ error: "Unauthorized to update post" });
	}

	// Check if we have either text, a single image, or multiple images
	const hasImages = Array.isArray(images) && images.length > 0;

	// Allow empty text if any image is provided
	if (!text && !img && !hasImages) {
		return res.status(400).json({ error: "Either text or at least one image is required for a post" });
	}

	const maxLength = 500;
	if (text && text.length > maxLength) {
		return res.status(400).json({ error: `Text must be less than ${maxLength} characters` });
	}

	// Process single image (for backward compatibility)
	if (img) {
		const uploadedResponse = await cloudinary.uploader.upload(img);
		img = uploadedResponse.secure_url;
	}

	// Process multiple images if provided
	const uploadedImages = [];
	if (hasImages) {
		// Upload each image to Cloudinary
		for (const imageData of images) {
			try {
				const uploadedResponse = await cloudinary.uploader.upload(imageData);
				uploadedImages.push(uploadedResponse.secure_url);
			} catch (error) {
				logger.error("Error uploading image to Cloudinary", error);
				// Continue with other images if one fails
			}
		}
	}

	// If we have a single image but no multiple images, use the single image
	if (img && !hasImages) {
		uploadedImages.push(img);
	}

	// Update the post
	const updateData = {
		text,
		img: uploadedImages.length > 0 ? uploadedImages[0] : post.img,
		images: uploadedImages.length > 0 ? uploadedImages : post.images
	};

	const updatedPost = await Post.findByIdAndUpdate(postId, updateData, { new: true })
		.populate("postedBy", "username profilePic");

	res.status(200).json(updatedPost);
} catch (err) {
	res.status(500).json({ error: err.message });
	logger.error("Error in updatePost", err);
}
};

const likeUnlikePost = async (req, res) => {
	try {
		const { id: postId } = req.params;
		const userId = req.user._id;

		const post = await Post.findById(postId);

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		const userLikedPost = post.likes.includes(userId);

		if (userLikedPost) {
			// Unlike post
			await Post.updateOne({ _id: postId }, { $pull: { likes: userId } });
			res.status(200).json({ message: "Post unliked successfully" });
		} else {
			// Like post
			post.likes.push(userId);
			await post.save();

			// Create like notification (only if someone else's post is liked)
			if (post.postedBy.toString() !== userId.toString()) {
				const newNotification = new Notification({
					recipient: post.postedBy,
					sender: userId,
					type: "like",
					postId: postId,
				});
				await newNotification.save();
			}

			res.status(200).json({ message: "Post liked successfully" });
		}
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

const replyToPost = async (req, res) => {
	try {
		console.log("replyToPost controller called");
		const { text } = req.body;
		let { img } = req.body;
		const postId = req.params.id;
		const userId = req.user._id;
		const userProfilePic = req.user.profilePic;
		const username = req.user.username;

		console.log(`User ${username} (${userId}) replying to post ${postId}`);
		console.log(`Reply content: ${text ? text.substring(0, 50) : 'No text'}, Image: ${img ? 'Yes' : 'No'}`);

		// Allow empty text if an image is provided
		if (!text && !img) {
			console.log("Error: No text or image provided");
			return res.status(400).json({ error: "Either text or image is required for a reply" });
		}

		const post = await Post.findById(postId);
		if (!post) {
			console.log(`Error: Post ${postId} not found`);
			return res.status(404).json({ error: "Post not found" });
		}

		// Upload image to Cloudinary if provided
		if (img) {
			console.log("Uploading image to Cloudinary");
			const uploadedResponse = await cloudinary.uploader.upload(img);
			img = uploadedResponse.secure_url;
			console.log("Image uploaded successfully:", img);
		}

		// Create reply object with all fields
		const reply = {
			userId,
			text,
			img,
			userProfilePic,
			username,
			createdAt: new Date()
		};
		console.log("Created reply object:", reply);

		// Add the reply to the beginning of the array for immediate visibility
		post.replies.unshift(reply);
		await post.save();
		console.log(`Reply saved to post ${postId}, reply ID: ${reply._id}`);

		// Create comment notification (only if someone else's post is commented on)
		if (post.postedBy.toString() !== userId.toString()) {
			console.log(`Creating notification for post owner ${post.postedBy}`);
			const newNotification = new Notification({
				recipient: post.postedBy,
				sender: userId,
				type: "comment",
				postId: postId,
			});
			await newNotification.save();
			console.log("Notification saved");

			// Send real-time notification to post owner
			console.log(`Sending real-time notification to post owner ${post.postedBy}`);
			sendMessageToUser(post.postedBy.toString(), "newReply", {
				postId,
				reply
			});
		}

		// Broadcast the reply to all users who might be viewing the post
		console.log(`Broadcasting reply to all users viewing post ${postId}`);
		const broadcastResult = broadcastPostUpdate(postId, {
			type: "newReply",
			reply,
			postId
		});
		console.log("Broadcast result:", broadcastResult);

		console.log("Sending response to client");
		res.status(200).json(reply);
	} catch (err) {
		console.error("Error in replyToPost:", err);
		res.status(500).json({ error: err.message });
		logger.error("Error in replyToPost", err);
	}
};

// Get trending posts based on engagement (likes and comments)
const getTrendingPosts = async (limit = 20) => {
	try {
		// Find all posts
		const posts = await Post.find({})
			.populate("postedBy", "username profilePic")
			.lean();

		// Calculate engagement score for each post (likes count + replies count)
		const postsWithEngagement = posts.map(post => {
			const likesCount = post.likes?.length || 0;
			const repliesCount = post.replies?.length || 0;
			const engagementScore = likesCount + repliesCount;

			return {
				...post,
				engagementScore
			};
		});

		// Sort by engagement score (highest first)
		const sortedPosts = postsWithEngagement.sort((a, b) => b.engagementScore - a.engagementScore);

		// Return the top posts based on limit
		return sortedPosts.slice(0, limit);
	} catch (error) {
		console.error("Error in getTrendingPosts:", error);
		throw error;
	}
};

// Route handler for trending posts
const getTrendingPostsHandler = async (req, res) => {
	try {
		// Get limit from query parameter or use default
		const limit = req.query.limit ? parseInt(req.query.limit) : 20;

		// Get trending posts
		const trendingPosts = await getTrendingPosts(limit);

		res.status(200).json(trendingPosts);
	} catch (error) {
		console.error("Error in getTrendingPostsHandler:", error);
		res.status(500).json({ error: error.message });
	}
};

const getFeedPosts = async (req, res) => {
	console.log("[getFeedPosts] Entering function..."); // Log entry point
	try {
		// Check if req.user exists
		if (!req.user) {
			console.error("[getFeedPosts] req.user is null or undefined");
			return res.status(401).json({ error: "User not authenticated" });
		}

		const userId = req.user._id;
		console.log(`[getFeedPosts] userId: ${userId}`); // Log the user ID

		const user = await User.findById(userId);
		if (!user) {
			console.error(`[getFeedPosts] User ${userId} not found after protectRoute.`);
			return res.status(404).json({ error: "User not found" });
		}
		console.log(`[getFeedPosts] Found user: ${user.username}`); // Log found user

		const following = user.following || [];
		const followers = user.followers || [];
		const notInterestedPosts = user.notInterestedPosts || [];
		console.log(`[getFeedPosts] User following: ${following.length}, followers: ${followers.length}, not interested posts: ${notInterestedPosts.length}`);

		let feedPosts = [];
		const now = new Date();
		const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

		// 1. PRIORITY CONTENT: Posts from people you follow + your own posts
		const followingIds = [...following, userId];
		console.log(`[getFeedPosts] Getting priority posts from ${followingIds.length} users`);

		const priorityPosts = await Post.find({
			postedBy: { $in: followingIds },
			_id: { $nin: notInterestedPosts } // Exclude not interested posts
		})
			.populate("postedBy", "username profilePic")
			.sort({ createdAt: -1 })
			.limit(30); // More posts from people you follow

		console.log(`[getFeedPosts] Found ${priorityPosts.length} priority posts`);

		// 2. DISCOVERY CONTENT: Mix of different types
		let discoveryPosts = [];

		// 2a. Recent trending posts (last 24 hours with high engagement)
		const recentTrending = await Post.find({
			postedBy: { $nin: followingIds },
			createdAt: { $gte: oneDayAgo },
			_id: { $nin: notInterestedPosts } // Exclude not interested posts
		})
			.populate("postedBy", "username profilePic")
			.lean();

		// Calculate engagement for recent posts
		const recentWithEngagement = recentTrending.map(post => {
			const likesCount = post.likes?.length || 0;
			const repliesCount = post.replies?.length || 0;
			const engagementScore = likesCount + (repliesCount * 2); // Comments worth more
			return { ...post, engagementScore };
		});

		// Get top trending from last 24 hours
		const topRecentTrending = recentWithEngagement
			.sort((a, b) => b.engagementScore - a.engagementScore)
			.slice(0, 8);

		console.log(`[getFeedPosts] Found ${topRecentTrending.length} recent trending posts`);

		// 2b. Posts from mutual connections (people who follow you but you don't follow back)
		const mutualConnections = await Post.find({
			postedBy: { $in: followers, $nin: followingIds },
			createdAt: { $gte: oneWeekAgo },
			_id: { $nin: notInterestedPosts } // Exclude not interested posts
		})
			.populate("postedBy", "username profilePic")
			.sort({ createdAt: -1 })
			.limit(5)
			.lean();

		console.log(`[getFeedPosts] Found ${mutualConnections.length} posts from mutual connections`);

		// 2c. Popular posts from the past week (for discovery)
		const weeklyPopular = await Post.find({
			postedBy: { $nin: [...followingIds, ...followers] },
			createdAt: { $gte: oneWeekAgo },
			_id: { $nin: notInterestedPosts } // Exclude not interested posts
		})
			.populate("postedBy", "username profilePic")
			.lean();

		const weeklyWithEngagement = weeklyPopular.map(post => {
			const likesCount = post.likes?.length || 0;
			const repliesCount = post.replies?.length || 0;
			const engagementScore = likesCount + (repliesCount * 2);
			return { ...post, engagementScore };
		});

		const topWeeklyPopular = weeklyWithEngagement
			.sort((a, b) => b.engagementScore - a.engagementScore)
			.slice(0, 7);

		console.log(`[getFeedPosts] Found ${topWeeklyPopular.length} weekly popular posts`);

		// 2d. Fresh content (recent posts from new users for discovery)
		const freshContent = await Post.find({
			postedBy: { $nin: [...followingIds, ...followers] },
			createdAt: { $gte: oneDayAgo },
			_id: { $nin: notInterestedPosts } // Exclude not interested posts
		})
			.populate("postedBy", "username profilePic")
			.sort({ createdAt: -1 })
			.limit(5)
			.lean();

		console.log(`[getFeedPosts] Found ${freshContent.length} fresh discovery posts`);

		// Combine all discovery content
		discoveryPosts = [
			...topRecentTrending,
			...mutualConnections,
			...topWeeklyPopular,
			...freshContent
		];

		// Remove duplicates from discovery posts
		const seenPostIds = new Set();
		discoveryPosts = discoveryPosts.filter(post => {
			if (seenPostIds.has(post._id.toString())) {
				return false;
			}
			seenPostIds.add(post._id.toString());
			return true;
		});

		console.log(`[getFeedPosts] Total discovery posts after deduplication: ${discoveryPosts.length}`);

		// 3. FACEBOOK-LIKE RANKING ALGORITHM
		const calculatePostScore = (post, isFromFollowing = false) => {
			const likesCount = post.likes?.length || 0;
			const repliesCount = post.replies?.length || 0;
			const postAge = (now - new Date(post.createdAt)) / (1000 * 60 * 60); // Age in hours

			// Base engagement score
			let engagementScore = likesCount + (repliesCount * 2);

			// Time decay factor (newer posts get boost)
			const timeDecay = Math.max(0, 1 - (postAge / 168)); // Decay over 1 week

			// Following boost
			const followingBoost = isFromFollowing ? 200 : 0;

			// Mutual connection boost
			const isMutualConnection = followers.includes(post.postedBy._id?.toString() || post.postedBy);
			const mutualBoost = isMutualConnection && !isFromFollowing ? 50 : 0;

			// Recent post boost (posts from last 6 hours)
			const recentBoost = postAge < 6 ? 30 : 0;

			// Final score calculation
			const finalScore = (engagementScore * timeDecay) + followingBoost + mutualBoost + recentBoost;

			return {
				...post,
				engagementScore: finalScore,
				isFromFollowing,
				isMutualConnection,
				postAge: Math.round(postAge * 10) / 10
			};
		};

		// Apply scoring to all posts
		const scoredPriorityPosts = priorityPosts.map(post =>
			calculatePostScore(post.toObject ? post.toObject() : post, true)
		);

		const scoredDiscoveryPosts = discoveryPosts.map(post =>
			calculatePostScore(post, false)
		);

		// Combine and sort all posts
		feedPosts = [...scoredPriorityPosts, ...scoredDiscoveryPosts];

		// Final sorting: engagement score first, then recency
		feedPosts.sort((a, b) => {
			if (Math.abs(b.engagementScore - a.engagementScore) > 5) {
				return b.engagementScore - a.engagementScore;
			}
			// If engagement scores are close, prioritize recency
			return new Date(b.createdAt) - new Date(a.createdAt);
		});

		// Limit final feed size
		feedPosts = feedPosts.slice(0, 50);

		console.log(`[getFeedPosts] Final feed composition:`);
		console.log(`- Priority posts: ${scoredPriorityPosts.length}`);
		console.log(`- Discovery posts: ${scoredDiscoveryPosts.length}`);
		console.log(`- Total final posts: ${feedPosts.length}`);

		// Clean up the response (remove scoring metadata)
		const cleanFeedPosts = feedPosts.map(post => {
			const { engagementScore, isFromFollowing, isMutualConnection, postAge, ...cleanPost } = post;
			return cleanPost;
		});

		res.status(200).json(cleanFeedPosts);
	} catch (err) {
		console.error("Error in getFeedPosts:", err);
		console.error("Error stack:", err.stack);
		console.error("Error name:", err.name);

		// Provide more specific error messages
		if (err.name === 'CastError') {
			return res.status(400).json({ error: "Invalid user ID format" });
		} else if (err.name === 'ValidationError') {
			return res.status(400).json({ error: "Data validation error" });
		} else if (err.message.includes('User not authenticated')) {
			return res.status(401).json({ error: "Authentication required" });
		}

		res.status(500).json({
			error: err.message,
			type: err.name,
			timestamp: new Date().toISOString()
		});
	}
};

const getUserPosts = async (req, res) => {
	const { username } = req.params;
	try {
		const user = await User.findOne({ username });
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Populate postedBy field for user posts
		const posts = await Post.find({ postedBy: user._id })
			.populate("postedBy", "username profilePic") // Populate user details
			.sort({ createdAt: -1 });

		res.status(200).json(posts);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

const repostPost = async (req, res) => {
	try {
		const { id: postId } = req.params;
		const userId = req.user._id;

		const post = await Post.findById(postId);

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		// Prevent reposting own post
		if (post.postedBy.toString() === userId.toString()) {
			return res.status(400).json({ error: "Cannot repost your own post" });
		}

		const userRepostedPost = post.reposts.includes(userId);

		if (userRepostedPost) {
			// Un-repost post
			await Post.updateOne({ _id: postId }, { $pull: { reposts: userId } });
			res.status(200).json({ message: "Post un-reposted successfully" });
		} else {
			// Repost post
			post.reposts.push(userId);
			await post.save();
			res.status(200).json({ message: "Post reposted successfully" });
		}
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

// New function to get posts where the user has replied
const getUserReplies = async (req, res) => {
	const { username } = req.params;
	try {
		const user = await User.findOne({ username });
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Find posts where the user's ID is in the replies array
		const posts = await Post.find({ "replies.userId": user._id })
			.populate("postedBy", "username profilePic") // Populate original poster details
			.sort({ createdAt: -1 }) // Sort by original post creation for now
			.lean(); // Use .lean() for plain JS objects to allow modification

		// Add the specific user's reply to each post object
		const postsWithSpecificReply = posts.map(post => {
			// Find the reply by this user within the post's replies array
			const userReply = post.replies.find(reply => reply.userId.toString() === user._id.toString());
			return {
				...post,
				userReply: userReply || null // Add the found reply (or null if somehow not found)
			};
		});

		res.status(200).json(postsWithSpecificReply);
	} catch (error) {
		res.status(500).json({ error: error.message });
		logger.error("Error in getUserReplies", error);
	}
};

// New function to get posts the user has reposted
const getUserReposts = async (req, res) => {
	const { username } = req.params;
	try {
		const user = await User.findOne({ username });
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Find posts where the user's ID is in the reposts array
		const repostedPosts = await Post.find({ reposts: user._id })
			.populate("postedBy", "username profilePic") // Populate original poster details
			.sort({ createdAt: -1 }); // Or sort by repost time if available/needed

		res.status(200).json(repostedPosts);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};


const replyToComment = async (req, res) => {
	try {
		const { text } = req.body;
		let { img } = req.body;
		const { postId, commentId } = req.params;
		const userId = req.user._id;
		const userProfilePic = req.user.profilePic;
		const username = req.user.username;

		// Allow empty text if an image is provided
		if (!text && !img) {
			return res.status(400).json({ error: "Either text or image is required for a reply" });
		}

		const post = await Post.findById(postId);
		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		// Find the comment to reply to
		const commentToReply = post.replies.id(commentId);
		if (!commentToReply) {
			return res.status(404).json({ error: "Comment not found" });
		}

		// Upload image to Cloudinary if provided
		if (img) {
			const uploadedResponse = await cloudinary.uploader.upload(img);
			img = uploadedResponse.secure_url;
		}

		// Create reply object with all fields
		const reply = {
			userId,
			text,
			img,
			userProfilePic,
			username,
			createdAt: new Date(),
			parentReplyId: commentId
		};

		// Add the reply to the beginning of the array for immediate visibility
		post.replies.unshift(reply);
		await post.save();

		// Create notification for the comment owner (if it's not the user's own comment)
		if (commentToReply.userId.toString() !== userId.toString()) {
			const newNotification = new Notification({
				recipient: commentToReply.userId,
				sender: userId,
				type: "comment",
				postId: postId,
			});
			await newNotification.save();

			// Send real-time notification to comment owner
			sendMessageToUser(commentToReply.userId.toString(), "newReply", {
				postId,
				reply,
				parentReplyId: commentId
			});
		}

		// Broadcast the reply to all users who might be viewing the post
		broadcastPostUpdate(postId, {
			type: "nestedReply",
			reply,
			postId,
			parentReplyId: commentId
		});

		res.status(200).json(reply);
	} catch (err) {
		res.status(500).json({ error: err.message });
		logger.error("Error in replyToComment", err);
	}
};

const likeUnlikeComment = async (req, res) => {
	try {
		const { postId, commentId } = req.params;
		const userId = req.user._id;

		const post = await Post.findById(postId);

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		// Find the comment in the post's replies array
		const comment = post.replies.id(commentId);

		if (!comment) {
			return res.status(404).json({ error: "Comment not found" });
		}

		// Initialize likes array if it doesn't exist
		if (!comment.likes) {
			comment.likes = [];
		}

		const userLikedComment = comment.likes.includes(userId);

		if (userLikedComment) {
			// Unlike comment - remove user ID from likes array
			comment.likes = comment.likes.filter(id => id.toString() !== userId.toString());
			await post.save();
			res.status(200).json({ message: "Comment unliked successfully" });
		} else {
			// Like comment - add user ID to likes array
			comment.likes.push(userId);
			await post.save();

			// Send a notification to the comment owner if it's not their own comment
			if (comment.userId.toString() !== userId.toString()) {
				const newNotification = new Notification({
					recipient: comment.userId,
					sender: userId,
					type: "like-comment",
					postId: postId,
				});
				await newNotification.save();
			}

			res.status(200).json({ message: "Comment liked successfully" });
		}
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

// Delete a comment/reply from a post
const deleteComment = async (req, res) => {
	try {
		const { postId, commentId } = req.params;
		const userId = req.user._id;

		// Find the post
		const post = await Post.findById(postId);
		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		// Find the comment
		const comment = post.replies.id(commentId);
		if (!comment) {
			return res.status(404).json({ error: "Comment not found" });
		}

		// Check if the user is authorized to delete the comment
		// Users can delete their own comments or comments on their own posts
		const isCommentOwner = comment.userId.toString() === userId.toString();
		const isPostOwner = post.postedBy.toString() === userId.toString();

		if (!isCommentOwner && !isPostOwner) {
			return res.status(401).json({ error: "Unauthorized to delete this comment" });
		}

		// Delete image from Cloudinary if it exists
		if (comment.img) {
			try {
				const imgId = comment.img.split("/").pop().split(".")[0];
				await cloudinary.uploader.destroy(imgId);
			} catch (error) {
				logger.error("Error deleting image from Cloudinary", error);
				// Continue with comment deletion even if image deletion fails
			}
		}

		// Remove the comment from the post using pull operator
		await Post.updateOne(
			{ _id: postId },
			{ $pull: { replies: { _id: commentId } } }
		);

		// Broadcast the deletion to all users viewing the post
		broadcastPostUpdate(postId, {
			type: "commentDeleted",
			commentId,
			postId
		});

		res.status(200).json({ message: "Comment deleted successfully" });
	} catch (err) {
		res.status(500).json({ error: err.message });
		logger.error("Error in deleteComment", err);
	}
};

const markPostNotInterested = async (req, res) => {
	try {
		console.log("=== MARK POST NOT INTERESTED FUNCTION CALLED ===");
		console.log("Request params:", req.params);
		console.log("Request query:", req.query);
		console.log("Request user:", req.user ? { id: req.user._id, username: req.user.username } : 'null');

		const { postId } = req.params;
		const userId = req.user._id;

		console.log(`[markPostNotInterested] User ${userId} marking post ${postId} as not interested`);

		// Check if post exists
		const post = await Post.findById(postId);
		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		// Add post to user's notInterestedPosts array if not already there
		const user = await User.findById(userId);
		if (!user.notInterestedPosts.includes(postId)) {
			user.notInterestedPosts.push(postId);
			await user.save();
			console.log(`[markPostNotInterested] Post ${postId} added to not interested list for user ${userId}`);
		} else {
			console.log(`[markPostNotInterested] Post ${postId} already in not interested list for user ${userId}`);
		}

		res.status(200).json({ message: "Post marked as not interested" });
	} catch (err) {
		console.error("Error in markPostNotInterested:", err);
		res.status(500).json({ error: err.message });
	}
};

export {
	createPost,
	getPost,
	deletePost,
	updatePost,
	likeUnlikePost,
	replyToPost,
	getFeedPosts,
	getUserPosts,
	repostPost,
	getUserReplies,
	getUserReposts,
	replyToComment,
	likeUnlikeComment,
	deleteComment,
	getTrendingPosts,
	getTrendingPostsHandler,
	markPostNotInterested,
};
