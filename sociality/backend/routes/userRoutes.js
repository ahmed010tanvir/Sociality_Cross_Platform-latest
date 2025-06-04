import express from "express";
import {
	followUnFollowUser,
	getUserProfile,
	loginUser,
	logoutUser,
	signupUser,
	updateUser,
	getSuggestedUsers,
	freezeAccount,
	searchUsers, // Import searchUsers
	resetFollowing, // Import resetFollowing
	deleteAccount, // Import deleteAccount
	completeProfile, // Import completeProfile
	checkProfileCompletion, // Import checkProfileCompletion
} from "../controllers/userController.js";
import protectRoute from "../middlewares/protectRoute.js";

const router = express.Router();

router.get("/profile/:query", getUserProfile);
router.get("/suggested", protectRoute, getSuggestedUsers);
router.post("/signup", signupUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.post("/follow/:id", protectRoute, followUnFollowUser); // Follow user
router.delete("/follow/:id", protectRoute, followUnFollowUser); // Unfollow user
router.put("/update/:id", protectRoute, updateUser);
router.put("/freeze", protectRoute, freezeAccount);

// Add route for searching users
router.get("/search", protectRoute, searchUsers);

// Add route for resetting following list
router.post("/reset-following", protectRoute, resetFollowing);

// Add route for deleting account
router.delete("/delete", protectRoute, deleteAccount);

// Add routes for profile completion
router.get("/profile-completion", protectRoute, checkProfileCompletion);
router.post("/complete-profile", protectRoute, completeProfile);

export default router;
