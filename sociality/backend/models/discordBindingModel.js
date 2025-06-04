import mongoose from 'mongoose';

const discordBindingSchema = mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true
    },
    discordChannelId: {
      type: String,
      required: true,
      unique: true, // Ensures one-to-one binding
      index: true
    },
    discordGuildId: {
      type: String,
      required: true
    },
    discordChannelName: {
      type: String,
      default: null
    },
    discordGuildName: {
      type: String,
      default: null
    },
    createdBy: {
      discordUserId: {
        type: String,
        required: true
      },
      discordUsername: {
        type: String,
        default: null
      },
      discordDisplayName: {
        type: String,
        required: true
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    },
    messageCount: {
      type: Number,
      default: 0
    },
    lastValidatedAt: {
      type: Date,
      default: Date.now
    },
    isValid: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
discordBindingSchema.index({ roomId: 1, discordChannelId: 1 });

// Static method to find binding by room ID
discordBindingSchema.statics.findByRoomId = function(roomId) {
  return this.findOne({ roomId, isActive: true, isValid: true });
};

// Static method to find binding by Discord channel ID
discordBindingSchema.statics.findByChannelId = function(discordChannelId) {
  return this.findOne({ discordChannelId, isActive: true, isValid: true });
};

// Static method to check if a channel is already bound
discordBindingSchema.statics.isChannelBound = function(discordChannelId) {
  return this.exists({ discordChannelId, isActive: true });
};

// Static method to check if a room is already bound to Discord
discordBindingSchema.statics.isRoomBoundToDiscord = function(roomId) {
  return this.exists({ roomId, isActive: true });
};

// Instance method to update last message timestamp
discordBindingSchema.methods.updateLastMessage = function() {
  this.lastMessageAt = new Date();
  this.messageCount += 1;
  return this.save();
};

// Instance method to validate binding
discordBindingSchema.methods.validateBinding = async function(client) {
  try {
    const channel = await client.channels.fetch(this.discordChannelId);
    if (channel) {
      this.isValid = true;
      this.lastValidatedAt = new Date();
      await this.save();
      return true;
    }
    return false;
  } catch (error) {
    this.isValid = false;
    this.lastValidatedAt = new Date();
    await this.save();
    return false;
  }
};

const DiscordBinding = mongoose.model("DiscordBinding", discordBindingSchema);

export default DiscordBinding;
