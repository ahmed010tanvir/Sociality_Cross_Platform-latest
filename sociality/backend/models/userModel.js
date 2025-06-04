import mongoose from "mongoose";

const userSchema = mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
		},
		username: {
			type: String,
			required: true,
			unique: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
		},
		password: {
			type: String,
			minLength: 6,
			required: function() {
				return !this.googleId; // Password not required for Google OAuth users
			},
		},
		profilePic: {
			type: String,
			default: "",
		},
		followers: {
			type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
			default: [],
		},
		following: {
			type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
			default: [],
		},
		bio: {
			type: String,
			default: "",
		},
		isFrozen: {
			type: Boolean,
			default: false,
		},
		// Google OAuth fields
		googleId: {
			type: String,
			unique: true,
			sparse: true, // Allows multiple null values
		},
		isGoogleUser: {
			type: Boolean,
			default: false,
		},
	// Profile completion tracking
	isProfileComplete: {
		type: Boolean,
		default: false,
	},
	// Posts the user is not interested in
	notInterestedPosts: {
		type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
		default: [],
	},
	},
	{
		timestamps: true,
	}
);

const User = mongoose.model("User", userSchema);

export default User;
