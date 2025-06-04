import mongoose from "mongoose";

const telegramBindingSchema = mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true
    },
    telegramChatId: {
      type: String,
      required: true,
      unique: true, // Ensures one-to-one binding
      index: true
    },
    telegramChatType: {
      type: String,
      enum: ['private', 'group', 'supergroup', 'channel'],
      required: true
    },
    telegramChatTitle: {
      type: String,
      default: null
    },
    createdBy: {
      telegramUserId: {
        type: String,
        required: true
      },
      telegramUsername: {
        type: String,
        default: null
      },
      telegramFirstName: {
        type: String,
        required: true
      },
      telegramLastName: {
        type: String,
        default: null
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
    }
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
telegramBindingSchema.index({ roomId: 1, isActive: 1 });
telegramBindingSchema.index({ telegramChatId: 1, isActive: 1 });

// Static method to find binding by room ID
telegramBindingSchema.statics.findByRoomId = function(roomId) {
  return this.findOne({ roomId, isActive: true });
};

// Static method to find binding by Telegram chat ID
telegramBindingSchema.statics.findByTelegramChatId = function(telegramChatId) {
  return this.findOne({ telegramChatId, isActive: true });
};

// Static method to check if a room is already bound
telegramBindingSchema.statics.isRoomBound = function(roomId) {
  return this.exists({ roomId, isActive: true });
};

// Static method to check if a Telegram chat is already bound
telegramBindingSchema.statics.isTelegramChatBound = function(telegramChatId) {
  return this.exists({ telegramChatId, isActive: true });
};

// Instance method to increment message count
telegramBindingSchema.methods.incrementMessageCount = function() {
  this.messageCount += 1;
  this.lastMessageAt = new Date();
  return this.save();
};

// Instance method to deactivate binding
telegramBindingSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

const TelegramBinding = mongoose.model("TelegramBinding", telegramBindingSchema);

export default TelegramBinding;
