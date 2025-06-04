import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
	{
		roomId: {
			type: String,
			required: true,
			unique: true,
			index: true
		},
		name: {
			type: String,
			required: true,
			trim: true
		},
		description: {
			type: String,
			default: "",
			maxLength: 500
		},
		creator: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true
		},
		participants: [{
			user: {
				type: mongoose.Schema.Types.ObjectId,
				ref: "User"
			},
			joinedAt: {
				type: Date,
				default: Date.now
			},
			role: {
				type: String,
				enum: ['admin', 'moderator', 'member'],
				default: 'member'
			}
		}],

		settings: {
			isPrivate: {
				type: Boolean,
				default: false
			},
			requireApproval: {
				type: Boolean,
				default: false
			},
			maxParticipants: {
				type: Number,
				default: 100
			}
		},

		// Cross-platform federation settings
		federationSettings: {
			isEnabled: {
				type: Boolean,
				default: false
			},
			allowedPlatforms: [{
				type: String,
				enum: ['sociality', 'telegram', 'discord', 'platform-a', 'platform-b', 'platform-c']
			}],
			registeredPeers: [String], // Array of peer URLs that host this room
			lastSyncAt: {
				type: Date,
				default: Date.now
			}
		},
		lastActivity: {
			type: Date,
			default: Date.now
		},
		messageCount: {
			type: Number,
			default: 0
		},
		isActive: {
			type: Boolean,
			default: true
		}
	},
	{ timestamps: true }
);

// Index for efficient queries
roomSchema.index({ 'participants.user': 1 });
roomSchema.index({ creator: 1 });
roomSchema.index({ lastActivity: -1 });
roomSchema.index({ 'federationSettings.isEnabled': 1 });

// Virtual for participant count
roomSchema.virtual('participantCount').get(function() {
	return this.participants.length;
});

// Method to add participant
roomSchema.methods.addParticipant = function(userId, role = 'member') {
	const existingParticipant = this.participants.find(p => p.user.toString() === userId.toString());
	if (!existingParticipant) {
		this.participants.push({
			user: userId,
			role: role,
			joinedAt: new Date()
		});
	}
	return this;
};

// Method to remove participant
roomSchema.methods.removeParticipant = function(userId) {
	this.participants = this.participants.filter(p => p.user.toString() !== userId.toString());
	return this;
};

// Method to check if user is participant
roomSchema.methods.isParticipant = function(userId) {
	return this.participants.some(p => p.user.toString() === userId.toString());
};



// Method to enable federation
roomSchema.methods.enableFederation = function(allowedPlatforms = ['telegram', 'discord']) {
	this.federationSettings.isEnabled = true;
	this.federationSettings.allowedPlatforms = ['sociality', ...allowedPlatforms];
	this.federationSettings.lastSyncAt = new Date();
	return this;
};

// Method to disable federation
roomSchema.methods.disableFederation = function() {
	this.federationSettings.isEnabled = false;
	this.federationSettings.allowedPlatforms = ['sociality'];
	this.federationSettings.registeredPeers = [];
	return this;
};

// Static method to find federated rooms
roomSchema.statics.findFederatedRooms = function() {
	return this.find({ 'federationSettings.isEnabled': true });
};

// Static method to find rooms by participant
roomSchema.statics.findByParticipant = function(userId) {
	return this.find({ 'participants.user': userId }).populate('creator', 'username name profilePic');
};

const Room = mongoose.model("Room", roomSchema);

export default Room;
