import express from "express";
import {
	createPost,
	deletePost,
	getPost,
	updatePost,
	likeUnlikePost,
	replyToPost,
	getFeedPosts,
	getUserPosts,
	getUserReplies,
	getUserReposts,
	repostPost,
	replyToComment,
	likeUnlikeComment,
	deleteComment,
	getTrendingPostsHandler,
	markPostNotInterested,
} from "../controllers/postController.js";
import protectRoute from "../middlewares/protectRoute.js";

const router = express.Router();

// Debug route for feed authentication
router.get("/feed/debug", async (req, res) => {
	try {
		const sessionPath = req.query.session || '';
		const cookieName = sessionPath ? `jwt-sociality${sessionPath.replace(/\//g, '-')}` : 'jwt-sociality';
		const token = req.cookies[cookieName] || req.cookies.jwt || req.cookies['jwt-sociality'];

		res.json({
			sessionPath,
			cookieName,
			hasToken: !!token,
			tokenLength: token ? token.length : 0,
			allCookies: Object.keys(req.cookies),
			userAgent: req.headers['user-agent'],
			origin: req.headers.origin,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/feed", protectRoute, getFeedPosts);
router.get("/trending", getTrendingPostsHandler); // Add route for trending posts
router.get("/user/:username", getUserPosts);
router.get("/user/:username/replies", getUserReplies); // Add route for user replies
router.get("/user/:username/reposts", getUserReposts); // Add route for user reposts
router.post("/create", protectRoute, createPost);
// Debug route to test if routing works
router.post("/debug-not-interested", (req, res) => {
	console.log("🔍 DEBUG: not-interested route hit!");
	res.json({ message: "Debug route working", timestamp: new Date().toISOString() });
});
router.post("/not-interested/:postId", protectRoute, markPostNotInterested); // Must be before /:id routes
router.post("/like/:id", protectRoute, likeUnlikePost); // Change to POST for like
router.post("/reply/:id", protectRoute, replyToPost); // Change to POST for reply
router.post("/repost/:id", protectRoute, repostPost); // Change to POST for repost
router.put("/comment/like/:postId/:commentId", protectRoute, likeUnlikeComment);
router.put("/reply/:postId/comment/:commentId", protectRoute, replyToComment);
router.delete("/comment/:postId/:commentId", protectRoute, deleteComment);
router.get("/:id", getPost); // Get post by ID - must be after other specific routes
router.delete("/:id", protectRoute, deletePost);
router.put("/:id", protectRoute, updatePost); // Add update post route

export default router;
