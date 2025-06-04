const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true
  },
  from: {
    userId: {
      type: String,
      required: true
    },
    displayName: {
      type: String,
      default: function() {
        // If no displayName is provided, use userId as fallback
        return this.from.userId;
      }
    },
    platform: {
      type: String,
      required: true
    }
  },
  text: {
    type: String,
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['sent', 'pending', 'delivered', 'failed'],
    default: 'sent'
  },
  metadata: {
    type: Object,
    default: {}
  }
});

module.exports = mongoose.model('Message', MessageSchema);
