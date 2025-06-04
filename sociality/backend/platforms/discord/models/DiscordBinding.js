const mongoose = require('mongoose');

const DiscordBindingSchema = new mongoose.Schema({
  discordChannelId: {
    type: String,
    required: true,
    unique: true
  },
  platformRoomId: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastValidatedAt: {
    type: Date,
    default: Date.now
  },
  isValid: {
    type: Boolean,
    default: true
  },
  isDynamic: {
    type: Boolean,
    default: false
  },
  priority: {
    type: Number,
    default: 0
  },
  isPermanent: {
    type: Boolean,
    default: true
  },
  dynamicRelayEnabled: {
    type: Boolean,
    default: true
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    userId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    }
  }
});

module.exports = mongoose.model('DiscordBinding', DiscordBindingSchema);
