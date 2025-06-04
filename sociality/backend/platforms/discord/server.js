require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { Client, GatewayIntentBits, Events, SlashCommandBuilder, REST, Routes } = require('discord.js');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// Import models
const Message = require('./models/Message');
const Room = require('./models/Room');
const DiscordBinding = require('./models/DiscordBinding');

// Import utilities
const { registerPlatform, announceRoom, getRoomPeers, getMessagesFromPeer, relayMessageToFederation } = require('./utils/federation');
const RetryManager = require('./utils/RetryManager');
const { relayMessageToDiscord } = require('./utils/discordRelay');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 7302;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/discord';
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PLATFORM_NAME = process.env.PLATFORM_NAME || 'discord';
const FEDERATION_REGISTRY_URL = process.env.FEDERATION_REGISTRY_URL || 'http://localhost:7300';
const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:7302';

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// Map to store Discord channel IDs to room IDs
const channelToRoomMap = new Map();
// Map to store room IDs to Discord channel IDs
const roomToChannelMap = new Map();
// Map to store Discord user IDs to usernames
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
  secret: process.env.SESSION_SECRET || 'discord-platform-secret',
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
app.set('discordClient', client);
app.set('channelToRoomMap', channelToRoomMap);
app.set('roomToChannelMap', roomToChannelMap);
app.set('userIdToNameMap', userIdToNameMap);
app.set('retryManager', retryManager);

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Discord Platform API' });
});

// Simple health check endpoint for federation registry
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'discord',
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

    // Relay to Discord
    await relayMessageToDiscord(client, roomId, message, roomToChannelMap);

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

    // Skip if message is from Discord to avoid loops
    if (message.from?.platform === 'discord' || message.from?.platform === 'platform-c') {
      console.log('⏭️ Skipping message from Discord to avoid loop');
      return res.json({ success: true, message: 'Message skipped (same platform)' });
    }

    // Relay to Discord only - let federation registry handle other platforms
    await relayMessageToDiscord(client, roomId, message, roomToChannelMap);

    // Emit to Socket.IO clients
    io.to(roomId).emit('newMessage', {
      roomId,
      message,
      timestamp: new Date()
    });

    res.json({ success: true, message: 'Message relayed to Discord successfully' });
  } catch (error) {
    console.error('❌ Error in cross-platform relay endpoint:', error);
    res.status(500).json({ error: 'Failed to relay message to Discord' });
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
app.post('/api/discord/test-bidirectional/:roomId', async (req, res) => {
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
    const { relayMessageToFederation } = require('./utils/federation');
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
      const { relayMessageToFederation } = require('./utils/federation');
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

// Discord bot event handlers
if (client) {
  // Bot ready event
  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`🎮 Discord bot ready! Logged in as ${readyClient.user.tag}`);

    // Register slash commands
    await registerSlashCommands();
  });

  // Handle slash commands
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
      switch (commandName) {
        case 'join':
          await handleJoinCommand(interaction);
          break;
        case 'create':
          await handleCreateCommand(interaction);
          break;
        case 'rooms':
          await handleRoomsCommand(interaction);
          break;
        case 'leave':
          await handleLeaveCommand(interaction);
          break;
        case 'status':
          await handleStatusCommand(interaction);
          break;
        default:
          await interaction.reply('❌ Unknown command');
      }
    } catch (error) {
      console.error('❌ Error handling slash command:', error);
      await interaction.reply('❌ An error occurred while processing the command');
    }
  });

  // Handle regular messages
  client.on(Events.MessageCreate, async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    const channelId = message.channel.id;
    const roomId = channelToRoomMap.get(channelId);

    if (!roomId) {
      return; // Not in a mapped room, ignore message
    }

    console.log(`📨 Discord message received in channel ${channelId} for room ${roomId}: ${message.content}`);

    try {
      // Store user info
      const username = message.author.username;
      userIdToNameMap.set(message.author.id, username);

      // Prepare message for federation
      const federatedMessage = {
        id: message.id,
        text: message.content || '[Attachment/Embed]',
        from: {
          userId: message.author.id,
          displayName: message.author.displayName || username,
          username: username,
          platform: 'discord'
        },
        sentAt: message.createdAt.toISOString(),
        timestamp: message.createdAt.toISOString(),
        roomId
      };

      // Send to federation registry for relay
      const relayResponse = await axios.post(`${FEDERATION_REGISTRY_URL}/federation/relay-message`, {
        roomId,
        message: federatedMessage,
        originatingPlatform: PLATFORM_URL
      });

      console.log(`📤 Message from ${username} relayed to federation registry:`, relayResponse.data);

      // Emit to local Socket.IO clients
      io.to(roomId).emit('newMessage', {
        roomId,
        message: federatedMessage,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('❌ Error relaying Discord message:', error.message);
    }
  });

}

// Slash command handlers
async function handleJoinCommand(interaction) {
  const roomId = interaction.options.getString('roomid');
  const channelId = interaction.channel.id;

  try {
    // Check if channel is already bound
    const existingBinding = await DiscordBinding.findOne({ discordChannelId: channelId });
    if (existingBinding) {
      await interaction.reply(`❌ This channel is already bound to room: ${existingBinding.platformRoomId}`);
      return;
    }

    // Create database binding
    const binding = new DiscordBinding({
      discordChannelId: channelId,
      platformRoomId: roomId,
      createdBy: {
        userId: interaction.user.id,
        username: interaction.user.username
      }
    });
    await binding.save();

    // Map this channel to the room in memory
    channelToRoomMap.set(channelId, roomId);
    roomToChannelMap.set(roomId, channelId);

    // Register room with federation registry
    await axios.post(`${FEDERATION_REGISTRY_URL}/federation/rooms`, {
      roomId,
      name: `Discord Room ${roomId}`,
      peerUrl: PLATFORM_URL
    });

    await interaction.reply(`✅ Successfully joined room: ${roomId}\nMessages in this channel will now be shared across platforms.`);
    console.log(`🎮 Discord channel ${channelId} joined room ${roomId} and saved binding to database`);
  } catch (error) {
    console.error('❌ Error joining room:', error);
    await interaction.reply(`❌ Failed to join room: ${error.message}`);
  }
}

async function handleCreateCommand(interaction) {
  const roomName = interaction.options.getString('name');
  const channelId = interaction.channel.id;

  try {
    // Check if channel is already bound
    const existingBinding = await DiscordBinding.findOne({ discordChannelId: channelId });
    if (existingBinding) {
      await interaction.reply(`❌ This channel is already bound to room: ${existingBinding.platformRoomId}`);
      return;
    }

    // Generate a simple room ID
    const roomId = Date.now().toString();

    // Create database binding
    const binding = new DiscordBinding({
      discordChannelId: channelId,
      platformRoomId: roomId,
      createdBy: {
        userId: interaction.user.id,
        username: interaction.user.username
      }
    });
    await binding.save();

    // Map this channel to the new room in memory
    channelToRoomMap.set(channelId, roomId);
    roomToChannelMap.set(roomId, channelId);

    // Register room with federation registry
    await axios.post(`${FEDERATION_REGISTRY_URL}/federation/rooms`, {
      roomId,
      name: roomName,
      peerUrl: PLATFORM_URL
    });

    await interaction.reply(`✅ Created and joined room: "${roomName}"\nRoom ID: ${roomId}\nShare this ID with others to join!`);
    console.log(`🎮 Discord channel ${channelId} created room ${roomId}: ${roomName} and saved binding to database`);
  } catch (error) {
    console.error('❌ Error creating room:', error);
    await interaction.reply(`❌ Failed to create room: ${error.message}`);
  }
}

async function handleRoomsCommand(interaction) {
  try {
    const response = await axios.get(`${FEDERATION_REGISTRY_URL}/federation/rooms`);
    const rooms = response.data;

    if (rooms.length === 0) {
      await interaction.reply('📭 No rooms available. Create one with `/create`');
      return;
    }

    let roomsList = '🏠 **Available Rooms:**\n\n';
    rooms.forEach((room, index) => {
      roomsList += `${index + 1}. **${room.name}**\n`;
      roomsList += `   ID: \`${room.roomId}\`\n`;
      roomsList += `   Platforms: ${room.peers.length}\n\n`;
    });

    roomsList += 'Use `/join` to join a room';
    await interaction.reply(roomsList);
  } catch (error) {
    console.error('❌ Error fetching rooms:', error);
    await interaction.reply('❌ Failed to fetch rooms list');
  }
}

async function handleLeaveCommand(interaction) {
  const channelId = interaction.channel.id;
  const roomId = channelToRoomMap.get(channelId);

  try {
    if (roomId) {
      // Remove from database
      await DiscordBinding.deleteOne({ discordChannelId: channelId });

      // Remove from memory
      channelToRoomMap.delete(channelId);
      roomToChannelMap.delete(roomId);

      await interaction.reply(`✅ Left room ${roomId}`);
      console.log(`🎮 Discord channel ${channelId} left room ${roomId} and removed binding from database`);
    } else {
      await interaction.reply('⚠️ This channel is not connected to any room');
    }
  } catch (error) {
    console.error('❌ Error leaving room:', error);
    await interaction.reply(`❌ Failed to leave room: ${error.message}`);
  }
}

async function handleStatusCommand(interaction) {
  const channelId = interaction.channel.id;
  const roomId = channelToRoomMap.get(channelId);

  if (roomId) {
    await interaction.reply(`📊 **Status**: Connected to room \`${roomId}\`\nMessages will be shared across platforms.`);
  } else {
    await interaction.reply('📊 **Status**: Not connected to any room\nUse `/join` to join a room');
  }
}

// Register slash commands
async function registerSlashCommands() {
  if (!CLIENT_ID || CLIENT_ID === 'YOUR_DISCORD_CLIENT_ID_HERE') {
    console.warn('⚠️ Discord client ID not configured. Slash commands will not be registered.');
    return;
  }

  const commands = [
    new SlashCommandBuilder()
      .setName('join')
      .setDescription('Join a cross-platform room')
      .addStringOption(option =>
        option.setName('roomid')
          .setDescription('The room ID to join')
          .setRequired(true)),

    new SlashCommandBuilder()
      .setName('create')
      .setDescription('Create a new cross-platform room')
      .addStringOption(option =>
        option.setName('name')
          .setDescription('The name of the room')
          .setRequired(true)),

    new SlashCommandBuilder()
      .setName('rooms')
      .setDescription('List available cross-platform rooms'),

    new SlashCommandBuilder()
      .setName('leave')
      .setDescription('Leave the current room'),

    new SlashCommandBuilder()
      .setName('status')
      .setDescription('Show current room status')
  ];

  const rest = new REST().setToken(BOT_TOKEN);

  try {
    console.log('🔄 Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log('✅ Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);
  }
}

// Load Discord bindings from database
async function loadDiscordBindings() {
  try {
    const { loadAndValidateDiscordBindings } = require('./utils/discordRelay');
    await loadAndValidateDiscordBindings(client, channelToRoomMap, roomToChannelMap);
  } catch (error) {
    console.error('Error loading Discord bindings:', error.message);
  }
}

// Validate all bindings
async function validateAllBindings() {
  try {
    const bindings = await DiscordBinding.find();
    console.log(`Validating ${bindings.length} Discord bindings...`);

    const { validateDiscordBinding } = require('./utils/discordRelay');

    for (const binding of bindings) {
      await validateDiscordBinding(client, binding);
    }

    console.log('Binding validation completed');
  } catch (error) {
    console.error('Error validating bindings:', error.message);
  }
}

// Register with federation registry on startup
const serverInstance = server.listen(PORT, async () => {
  try {
    console.log(`Discord Platform server running on port ${PORT}`);

    // Login to Discord
    await client.login(BOT_TOKEN);
    console.log('Discord bot logged in');

    // Load Discord bindings from database
    await loadDiscordBindings();

    // Register with federation registry
    await registerPlatform();
    console.log('Platform registered with federation registry');

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
  console.log('SIGTERM signal received: closing HTTP server');
  if (client) {
    client.destroy();
  }
  serverInstance.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  if (client) {
    client.destroy();
  }
  serverInstance.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
