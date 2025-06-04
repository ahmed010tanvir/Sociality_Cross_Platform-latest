require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// Import models
const Message = require('./models/Message');
const Room = require('./models/Room');
const TelegramBinding = require('./models/TelegramBinding');

// Import utilities
const { registerPlatform, announceRoom, getRoomPeers, getMessagesFromPeer, relayMessageToFederation } = require('./utils/federation');
const RetryManager = require('./utils/RetryManager');
const { relayMessageToTelegram } = require('./utils/telegramRelay');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 7301;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/telegram';
const BOT_TOKEN = process.env.BOT_TOKEN;
const PLATFORM_NAME = process.env.PLATFORM_NAME || 'telegram';
const FEDERATION_REGISTRY_URL = process.env.FEDERATION_REGISTRY_URL || 'http://localhost:7300';
const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:7301';

// Initialize Telegram bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Map to store Telegram chat IDs to room IDs
const chatToRoomMap = new Map();
// Map to store room IDs to Telegram chat IDs
const roomToChatMap = new Map();
// Map to store Telegram user IDs to usernames
const userIdToNameMap = new Map();
// Set to track processed message IDs to prevent duplicates
const processedMessageIds = new Set();

// Initialize retry manager
const retryManager = new RetryManager();

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'telegram-platform-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI
  }),
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Store instances for use in routes
app.set('io', io);
app.set('telegramBot', bot);
app.set('chatToRoomMap', chatToRoomMap);
app.set('roomToChatMap', roomToChatMap);
app.set('userIdToNameMap', userIdToNameMap);
app.set('retryManager', retryManager);

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Telegram Platform API' });
});

// Simple health check endpoint for federation registry
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'telegram',
    timestamp: new Date().toISOString(),
    federation: process.env.FEDERATION_ENABLED !== 'false'
  });
});

// Import route handlers
const roomsRouter = require('./routes/rooms');
app.use('/api/rooms', roomsRouter);

// Relay endpoint for receiving messages from other platforms
app.post('/api/relay', async (req, res) => {
  try {
    const { roomId, message } = req.body;

    if (!roomId || !message) {
      return res.status(400).json({ error: 'roomId and message are required' });
    }

    console.log(`Received relay message for room ${roomId}:`, message);

    // Relay to Telegram
    await relayMessageToTelegram(bot, roomId, message, roomToChatMap);

    // Emit to Socket.IO clients
    io.to(roomId).emit('newMessage', {
      roomId,
      message,
      timestamp: new Date()
    });

    res.json({ success: true, message: 'Message relayed successfully' });
  } catch (error) {
    console.error('Error in relay endpoint:', error);
    res.status(500).json({ error: 'Failed to relay message' });
  }
});

// Cross-platform relay endpoint (used by federation registry)
app.post('/api/cross-platform/relay', async (req, res) => {
  try {
    const { roomId, message } = req.body;

    if (!roomId || !message) {
      return res.status(400).json({ error: 'roomId and message are required' });
    }

    console.log(`📨 Received cross-platform relay message for room ${roomId} from ${message.from?.platform || 'unknown'}:`, message);

    // Skip if message is from Telegram to avoid loops
    if (message.from?.platform === 'telegram' || message.from?.platform === 'platform-b') {
      console.log('⏭️ Skipping message from Telegram to avoid loop');
      return res.json({ success: true, message: 'Message skipped (same platform)' });
    }

    // Relay to Telegram only - let federation registry handle other platforms
    await relayMessageToTelegram(bot, roomId, message, roomToChatMap);

    // Emit to Socket.IO clients
    io.to(roomId).emit('newMessage', {
      roomId,
      message,
      timestamp: new Date()
    });

    res.json({ success: true, message: 'Message relayed to Telegram successfully' });
  } catch (error) {
    console.error('❌ Error in cross-platform relay endpoint:', error);
    res.status(500).json({ error: 'Failed to relay message to Telegram' });
  }
});

// Get messages for a room
app.get('/api/messages/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { since, limit = 50 } = req.query;

    let query = { roomId };
    if (since) {
      query.sentAt = { $gt: new Date(since) };
    }

    const messages = await Message.find(query)
      .sort({ sentAt: -1 })
      .limit(parseInt(limit));

    res.json(messages.reverse());
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to test bidirectional message relay
app.post('/api/telegram/test-bidirectional/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { message, platform = 'platform-a' } = req.body;

    if (!roomId) {
      return res.status(400).json({ error: 'roomId is required' });
    }

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    console.log(`Testing bidirectional message relay for room ${roomId}`);
    console.log(`Sending test message from platform ${platform}: "${message}"`);

    // Create a test message
    const testMessage = new Message({
      roomId,
      from: {
        userId: 'test-user',
        displayName: 'Test User',
        platform
      },
      text: message,
      sentAt: new Date()
    });

    await testMessage.save();

    // Relay to federation
    await relayMessageToFederation(roomId, testMessage);

    res.json({
      success: true,
      message: 'Test message sent successfully',
      data: testMessage
    });
  } catch (error) {
    console.error('Error in test bidirectional endpoint:', error);
    res.status(500).json({ error: 'Failed to send test message' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('joinRoom', ({ roomId, userId, platform }) => {
    socket.join(roomId);
    console.log(`User ${userId} from ${platform} joined room ${roomId}`);

    socket.to(roomId).emit('userJoined', { roomId, userId, platform });
  });

  // Send message
  socket.on('sendMessage', async ({ roomId, message }) => {
    try {
      // Save message to database
      const newMessage = new Message(message);
      await newMessage.save();

      // Emit to room
      io.to(roomId).emit('newMessage', {
        roomId,
        message: newMessage,
        timestamp: new Date()
      });

      // Relay to federation
      await relayMessageToFederation(roomId, newMessage);
    } catch (error) {
      console.error('Error handling socket message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicators
  socket.on('startTyping', ({ roomId, userId, platform }) => {
    socket.to(roomId).emit('startTyping', { roomId, userId, platform });
  });

  socket.on('stopTyping', ({ roomId, userId, platform }) => {
    socket.to(roomId).emit('stopTyping', { roomId, userId, platform });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Telegram bot event handlers
if (bot) {
  // Handle /start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `
🤖 Welcome to Sociality Telegram Bridge!

Available commands:
/join <roomId> - Join a cross-platform room
/create <roomName> - Create a new room
/rooms - List available rooms
/help - Show this help message

This bot connects your Telegram chat to the Sociality platform for cross-platform messaging.
    `;
    bot.sendMessage(chatId, welcomeMessage);
  });

  // Handle /help command
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
🆘 Sociality Telegram Bridge Help

Commands:
/start - Welcome message
/join <roomId> - Join a cross-platform room
/create <roomName> - Create a new room
/rooms - List available rooms
/leave - Leave current room
/status - Show current room status

Example:
/join 507f1f77bcf86cd799439011
/create "My Cross Platform Room"
    `;
    bot.sendMessage(chatId, helpMessage);
  });

  // Handle /join command
  bot.onText(/\/join (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const roomId = match[1].trim();

    try {
      // Map this chat to the room
      chatToRoomMap.set(chatId.toString(), roomId);
      roomToChatMap.set(roomId, chatId.toString());

      // Register room with federation registry
      await axios.post(`${FEDERATION_REGISTRY_URL}/federation/rooms`, {
        roomId,
        name: `Telegram Room ${roomId}`,
        peerUrl: PLATFORM_URL
      });

      bot.sendMessage(chatId, `✅ Successfully joined room: ${roomId}\nMessages in this chat will now be shared across platforms.`);
      console.log(`📱 Telegram chat ${chatId} joined room ${roomId}`);
    } catch (error) {
      console.error('❌ Error joining room:', error);
      bot.sendMessage(chatId, `❌ Failed to join room: ${error.message}`);
    }
  });

  // Handle /create command
  bot.onText(/\/create (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const roomName = match[1].trim().replace(/['"]/g, '');

    try {
      // Generate a simple room ID
      const roomId = Date.now().toString();

      // Map this chat to the new room
      chatToRoomMap.set(chatId.toString(), roomId);
      roomToChatMap.set(roomId, chatId.toString());

      // Register room with federation registry
      await axios.post(`${FEDERATION_REGISTRY_URL}/federation/rooms`, {
        roomId,
        name: roomName,
        peerUrl: PLATFORM_URL
      });

      bot.sendMessage(chatId, `✅ Created and joined room: "${roomName}"\nRoom ID: ${roomId}\nShare this ID with others to join!`);
      console.log(`📱 Telegram chat ${chatId} created room ${roomId}: ${roomName}`);
    } catch (error) {
      console.error('❌ Error creating room:', error);
      bot.sendMessage(chatId, `❌ Failed to create room: ${error.message}`);
    }
  });

  // Handle /rooms command
  bot.onText(/\/rooms/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const response = await axios.get(`${FEDERATION_REGISTRY_URL}/federation/rooms`);
      const rooms = response.data;

      if (rooms.length === 0) {
        bot.sendMessage(chatId, '📭 No rooms available. Create one with /create <roomName>');
        return;
      }

      let roomsList = '🏠 Available Rooms:\n\n';
      rooms.forEach((room, index) => {
        roomsList += `${index + 1}. ${room.name}\n`;
        roomsList += `   ID: ${room.roomId}\n`;
        roomsList += `   Platforms: ${room.peers.length}\n\n`;
      });

      roomsList += 'Use /join <roomId> to join a room';
      bot.sendMessage(chatId, roomsList);
    } catch (error) {
      console.error('❌ Error fetching rooms:', error);
      bot.sendMessage(chatId, '❌ Failed to fetch rooms list');
    }
  });

  // Handle /status command
  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const roomId = chatToRoomMap.get(chatId.toString());

    if (roomId) {
      bot.sendMessage(chatId, `📊 Status: Connected to room ${roomId}\nMessages will be shared across platforms.`);
    } else {
      bot.sendMessage(chatId, '📊 Status: Not connected to any room\nUse /join <roomId> to join a room');
    }
  });

  // Handle /leave command
  bot.onText(/\/leave/, (msg) => {
    const chatId = msg.chat.id;
    const roomId = chatToRoomMap.get(chatId.toString());

    if (roomId) {
      chatToRoomMap.delete(chatId.toString());
      roomToChatMap.delete(roomId);
      bot.sendMessage(chatId, `✅ Left room ${roomId}`);
      console.log(`📱 Telegram chat ${chatId} left room ${roomId}`);
    } else {
      bot.sendMessage(chatId, '⚠️ You are not in any room');
    }
  });

  // Handle regular messages
  bot.on('message', async (msg) => {
    // Skip if it's a command
    if (msg.text && msg.text.startsWith('/')) {
      return;
    }

    // Skip non-text messages for now
    if (!msg.text) {
      return;
    }

    const chatId = msg.chat.id;

    try {
      // First check in-memory map (for /join command bindings)
      let roomId = chatToRoomMap.get(chatId.toString());

      // If not found in memory, check database bindings
      if (!roomId) {
        const binding = await TelegramBinding.findOne({
          telegramChatId: chatId.toString(),
          isActive: true
        });

        if (binding) {
          roomId = binding.roomId;
          // Update in-memory maps for faster future lookups
          chatToRoomMap.set(chatId.toString(), roomId);
          roomToChatMap.set(roomId, chatId.toString());
          console.log(`📋 Loaded binding from database: chat ${chatId} -> room ${roomId}`);

          // Ensure room is registered with federation registry
          try {
            await axios.post(`${FEDERATION_REGISTRY_URL}/federation/rooms`, {
              roomId,
              name: `Telegram Room ${roomId}`,
              peerUrl: PLATFORM_URL
            });
            console.log(`🔗 Registered room ${roomId} with federation registry`);
          } catch (registrationError) {
            // Room might already be registered, which is fine
            console.log(`📝 Room ${roomId} registration: ${registrationError.response?.data?.message || registrationError.message}`);
          }
        }
      }

      if (!roomId) {
        console.log(`⚠️ No room binding found for Telegram chat ${chatId}`);
        return; // Not in a room, ignore message
      }

      // Store user info
      const username = msg.from.username || msg.from.first_name || 'Unknown User';
      userIdToNameMap.set(msg.from.id.toString(), username);

      // Prepare message for federation with correct structure for Sociality
      const federatedMessage = {
        id: msg.message_id.toString(),
        text: msg.text,
        from: {
          userId: msg.from.id.toString(),        // Sociality expects userId
          id: msg.from.id.toString(),            // Keep id for backward compatibility
          displayName: username,                 // Sociality expects displayName
          username: username,                    // Keep username for backward compatibility
          platform: 'telegram'
        },
        sentAt: new Date(msg.date * 1000).toISOString(),  // Sociality expects sentAt
        timestamp: new Date(msg.date * 1000).toISOString(), // Keep timestamp for backward compatibility
        roomId
      };

      console.log(`📨 Received message from ${username} in chat ${chatId} for room ${roomId}: "${msg.text}"`);

      // Send to federation registry for relay
      await axios.post(`${FEDERATION_REGISTRY_URL}/federation/relay-message`, {
        roomId,
        message: federatedMessage,
        originatingPlatform: PLATFORM_URL
      });

      console.log(`📤 Message from ${username} relayed to federation for room ${roomId}`);

      // Update binding message count if it exists in database
      try {
        await TelegramBinding.findOneAndUpdate(
          { telegramChatId: chatId.toString(), isActive: true },
          {
            $inc: { messageCount: 1 },
            $set: { lastMessageAt: new Date() }
          }
        );
      } catch (updateError) {
        console.warn('Failed to update binding message count:', updateError.message);
      }

    } catch (error) {
      console.error('❌ Error relaying message:', error);
    }
  });

  console.log('🎯 Telegram bot event handlers registered');
}

// Load Telegram bindings from database
async function loadTelegramBindings() {
  try {
    const { loadAndValidateTelegramBindings } = require('./utils/telegramRelay');
    await loadAndValidateTelegramBindings(bot, chatToRoomMap, roomToChatMap);

    // Also register all active bindings with federation registry
    await registerExistingBindingsWithFederation();
  } catch (error) {
    console.error('Error loading Telegram bindings:', error.message);
  }
}

// Register all existing database bindings with federation registry
async function registerExistingBindingsWithFederation() {
  try {
    const bindings = await TelegramBinding.find({ isActive: true });
    console.log(`🔗 Registering ${bindings.length} existing Telegram bindings with federation registry...`);

    for (const binding of bindings) {
      try {
        await axios.post(`${FEDERATION_REGISTRY_URL}/federation/rooms`, {
          roomId: binding.roomId,
          name: `Telegram Room ${binding.roomId}`,
          peerUrl: PLATFORM_URL
        });

        // Also update in-memory maps
        chatToRoomMap.set(binding.telegramChatId, binding.roomId);
        roomToChatMap.set(binding.roomId, binding.telegramChatId);

        console.log(`✅ Registered room ${binding.roomId} (chat ${binding.telegramChatId}) with federation`);
      } catch (error) {
        // Room might already be registered, which is fine
        console.log(`📝 Room ${binding.roomId} registration: ${error.response?.data?.message || error.message}`);
      }
    }

    console.log(`🎯 Completed federation registry registration for existing bindings`);
  } catch (error) {
    console.error('Error registering existing bindings with federation:', error.message);
  }
}

// Validate all bindings
async function validateAllBindings() {
  try {
    const bindings = await TelegramBinding.find();
    console.log(`Validating ${bindings.length} Telegram bindings...`);

    const { validateTelegramBinding } = require('./utils/telegramRelay');

    for (const binding of bindings) {
      await validateTelegramBinding(bot, binding);
    }

    console.log('Binding validation completed');
  } catch (error) {
    console.error('Error validating bindings:', error.message);
  }
}

// Register with federation registry on startup
const serverInstance = server.listen(PORT, async () => {
  try {
    console.log(`Telegram Platform server running on port ${PORT}`);

    // Load Telegram bindings from database
    await loadTelegramBindings();

    // Register with federation registry
    await registerPlatform();

    // Schedule binding validation to run after startup
    setTimeout(async () => {
      try {
        await validateAllBindings();
      } catch (error) {
        console.error('Scheduled binding validation failed:', error.message);
      }
    }, 10000); // Run 10 seconds after startup
  } catch (error) {
    console.error('Failed during startup, continuing anyway:', error.message);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing server');
  if (bot) {
    bot.stopPolling();
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing server');
  if (bot) {
    bot.stopPolling();
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
