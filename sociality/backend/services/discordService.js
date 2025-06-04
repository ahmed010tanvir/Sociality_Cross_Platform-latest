import express from 'express';
import cors from 'cors';
import axios from 'axios';
import mongoose from 'mongoose';
import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } from 'discord.js';

const app = express();
const PORT = process.env.DISCORD_PORT || 7302;

// Middleware
app.use(cors());
app.use(express.json());

// Import Discord binding model
import DiscordBinding from '../models/discordBindingModel.js';

// Discord Bot Configuration
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'YOUR_DISCORD_BOT_TOKEN';
const FEDERATION_REGISTRY_URL = process.env.FEDERATION_REGISTRY_URL || 'http://localhost:7300';
const PLATFORM_URL = process.env.DISCORD_PLATFORM_URL || 'http://localhost:7302';

// Initialize Discord Client (only if token is provided)
let client = null;
const discordChannels = new Map(); // Map room IDs to Discord channel IDs
const roomMappings = new Map(); // Map Discord channel IDs to room IDs

// Discord Application ID for slash commands
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (DISCORD_BOT_TOKEN && DISCORD_BOT_TOKEN !== 'YOUR_DISCORD_BOT_TOKEN') {
  try {
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ]
    });

    client.once('ready', async () => {
      console.log(`✅ Discord Bot logged in as ${client.user.tag}`);

      // Register slash commands
      await registerSlashCommands();

      // Load existing bindings from database
      await loadDiscordBindings();
    });

    client.on('messageCreate', async (message) => {
      try {
        // Ignore bot messages and messages without content
        if (message.author.bot || !message.content) return;

        const channelId = message.channel.id;

        // Check if this channel is bound to a room
        const binding = await DiscordBinding.findByChannelId(channelId);
        let roomId = null;

        if (binding) {
          roomId = binding.roomId;
        } else {
          // Check in-memory map as fallback
          roomId = roomMappings.get(channelId);
          if (!roomId) return;
        }

        // Relay message to federation registry
        const federatedMessage = {
          from: {
            userId: message.author.id,
            displayName: message.author.displayName || message.author.username,
            platform: 'discord'
          },
          text: message.content,
          sentAt: new Date()
        };

        try {
          await axios.post(`${FEDERATION_REGISTRY_URL}/federation/relay-message`, {
            roomId,
            message: federatedMessage,
            originatingPlatform: PLATFORM_URL
          });

          // Update binding message count if binding exists
          if (binding) {
            await binding.updateLastMessage();
          }

          console.log(`📨 Relayed Discord message from ${message.author.username} in room ${roomId}`);
        } catch (error) {
          console.error('Failed to relay Discord message:', error.message);
        }
      } catch (error) {
        console.error('Error handling Discord message:', error);
      }
    });

    // Handle slash command interactions
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const { commandName } = interaction;

      if (commandName === 'join') {
        await handleJoinCommand(interaction);
      } else if (commandName === 'leave') {
        await handleLeaveCommand(interaction);
      } else if (commandName === 'status') {
        await handleStatusCommand(interaction);
      }
    });

    // Login to Discord with error handling
    client.login(DISCORD_BOT_TOKEN).catch(error => {
      console.warn('⚠️ Failed to login to Discord:', error.message);
      console.warn('Discord integration will be disabled. Please check your DISCORD_BOT_TOKEN.');
      client = null; // Reset client to null so other parts of the code know it's not available
    });
    console.log('✅ Discord Client initialized');

  } catch (error) {
    console.warn('⚠️ Failed to initialize Discord Bot:', error.message);
  }
} else {
  console.warn('⚠️ Discord Bot Token not provided. Discord integration disabled.');
}

// Register slash commands
async function registerSlashCommands() {
  if (!DISCORD_CLIENT_ID || !DISCORD_BOT_TOKEN) {
    console.warn('⚠️ Discord Client ID or Bot Token missing. Slash commands not registered.');
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
      .setName('leave')
      .setDescription('Leave the current cross-platform room'),

    new SlashCommandBuilder()
      .setName('status')
      .setDescription('Check the current room connection status')
  ];

  const rest = new REST().setToken(DISCORD_BOT_TOKEN);

  try {
    console.log('🔄 Started refreshing Discord slash commands.');

    await rest.put(
      Routes.applicationCommands(DISCORD_CLIENT_ID),
      { body: commands }
    );

    console.log('✅ Successfully registered Discord slash commands.');
  } catch (error) {
    console.error('❌ Error registering Discord slash commands:', error);
  }
}

// Load Discord bindings from database
async function loadDiscordBindings() {
  try {
    const bindings = await DiscordBinding.find({ isActive: true, isValid: true });

    console.log(`📚 Loading ${bindings.length} Discord bindings from database...`);

    for (const binding of bindings) {
      discordChannels.set(binding.roomId, binding.discordChannelId);
      roomMappings.set(binding.discordChannelId, binding.roomId);

      // Validate binding in background
      if (client && client.isReady()) {
        binding.validateBinding(client).catch(error => {
          console.error(`Background validation failed for Discord binding ${binding._id}:`, error.message);
        });
      }
    }

    console.log(`✅ Loaded ${bindings.length} Discord bindings into memory`);
  } catch (error) {
    console.error('❌ Error loading Discord bindings:', error.message);
  }
}

// Handle /join command
async function handleJoinCommand(interaction) {
  try {
    await interaction.deferReply();

    const roomId = interaction.options.getString('roomid');
    const channelId = interaction.channel.id;
    const guildId = interaction.guild?.id;
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const displayName = interaction.user.displayName || interaction.user.username;

    // Check if this channel is already bound to a room
    const existingBinding = await DiscordBinding.findByChannelId(channelId);
    if (existingBinding) {
      await interaction.editReply({
        content: `❌ **This channel is already connected to room:** \`${existingBinding.roomId}\`\n\nUse \`/leave\` first to disconnect from the current room.`,
        ephemeral: true
      });
      return;
    }

    // Check if the room is already bound to another Discord channel
    const roomBinding = await DiscordBinding.findByRoomId(roomId);
    if (roomBinding) {
      await interaction.editReply({
        content: `❌ **Room \`${roomId}\` is already connected to another Discord channel.**\n\nEach room can only be bound to one Discord channel at a time.`,
        ephemeral: true
      });
      return;
    }

    // Create new binding
    const binding = new DiscordBinding({
      roomId,
      discordChannelId: channelId,
      discordGuildId: guildId,
      discordChannelName: interaction.channel.name,
      discordGuildName: interaction.guild?.name,
      createdBy: {
        discordUserId: userId,
        discordUsername: username,
        discordDisplayName: displayName
      }
    });

    await binding.save();

    // Update in-memory mappings
    discordChannels.set(roomId, channelId);
    roomMappings.set(channelId, roomId);

    // Register room with federation registry
    try {
      await axios.post(`${FEDERATION_REGISTRY_URL}/federation/rooms`, {
        roomId,
        name: `Discord Room ${roomId}`,
        peerUrl: PLATFORM_URL
      });
    } catch (error) {
      console.warn('Failed to register room with federation registry:', error.message);
    }

    await interaction.editReply({
      content: `✅ **Successfully connected to cross-platform room!**\n\n` +
               `🏠 **Room ID:** \`${roomId}\`\n` +
               `💬 **Messages in this channel will now be shared with users on other platforms.**\n` +
               `📱 **Users on Sociality web app and Telegram can now chat with you!**\n\n` +
               `**Commands:**\n` +
               `• \`/status\` - Check connection status\n` +
               `• \`/leave\` - Disconnect from the room`
    });

    console.log(`🔗 Discord channel ${channelId} joined room ${roomId}`);
  } catch (error) {
    console.error('Error handling Discord /join command:', error);
    await interaction.editReply({
      content: `❌ **Failed to join room:** ${error.message}`,
      ephemeral: true
    });
  }
}

// Handle /leave command
async function handleLeaveCommand(interaction) {
  try {
    await interaction.deferReply();

    const channelId = interaction.channel.id;

    // Find existing binding
    const binding = await DiscordBinding.findByChannelId(channelId);
    if (!binding) {
      await interaction.editReply({
        content: `⚠️ **This channel is not connected to any room.**\n\nUse \`/join <roomid>\` to connect to a room.`,
        ephemeral: true
      });
      return;
    }

    const roomId = binding.roomId;

    // Remove binding
    binding.isActive = false;
    await binding.save();

    // Update in-memory mappings
    discordChannels.delete(roomId);
    roomMappings.delete(channelId);

    await interaction.editReply({
      content: `✅ **Successfully disconnected from room \`${roomId}\`**\n\n` +
               `💬 **This channel is no longer connected to cross-platform messaging.**`
    });

    console.log(`🔗 Discord channel ${channelId} left room ${roomId}`);
  } catch (error) {
    console.error('Error handling Discord /leave command:', error);
    await interaction.editReply({
      content: `❌ **Failed to leave room:** ${error.message}`,
      ephemeral: true
    });
  }
}

// Handle /status command
async function handleStatusCommand(interaction) {
  try {
    await interaction.deferReply();

    const channelId = interaction.channel.id;
    const binding = await DiscordBinding.findByChannelId(channelId);

    if (binding) {
      const connectedSince = binding.createdAt.toLocaleDateString();
      const messageCount = binding.messageCount;

      await interaction.editReply({
        content: `📊 **Connection Status**\n\n` +
                 `✅ **Connected to room:** \`${binding.roomId}\`\n` +
                 `📅 **Connected since:** ${connectedSince}\n` +
                 `💬 **Messages relayed:** ${messageCount}\n` +
                 `🌐 **Cross-platform messaging is active**\n\n` +
                 `**Commands:**\n` +
                 `• \`/leave\` - Disconnect from the room`
      });
    } else {
      await interaction.editReply({
        content: `📊 **Connection Status**\n\n` +
                 `❌ **Not connected to any room**\n` +
                 `💡 **Use \`/join <roomid>\` to connect to a cross-platform room**`
      });
    }
  } catch (error) {
    console.error('Error handling Discord /status command:', error);
    await interaction.editReply({
      content: `❌ **Failed to get status:** ${error.message}`,
      ephemeral: true
    });
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'discord',
    timestamp: new Date().toISOString(),
    botActive: client !== null && client.isReady(),
    connectedChannels: discordChannels.size
  });
});

// Connect a Discord channel to a room
app.post('/connect-room', async (req, res) => {
  try {
    const { roomId, channelId } = req.body;

    if (!roomId || !channelId) {
      return res.status(400).json({
        success: false,
        error: 'Room ID and Channel ID are required'
      });
    }

    // Store the mapping
    discordChannels.set(roomId, channelId);
    roomMappings.set(channelId, roomId);

    console.log(`🔗 Connected Discord channel ${channelId} to room ${roomId}`);

    // Send confirmation message to Discord channel
    if (client && client.isReady()) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          await channel.send(
            `🎉 **Successfully connected to cross-platform room!**\n\n` +
            `🏠 **Room ID:** \`${roomId}\`\n` +
            `💬 You can now chat with users from other platforms.`
          );
        }
      } catch (error) {
        console.warn('Failed to send confirmation to Discord:', error.message);
      }
    }

    res.json({
      success: true,
      message: 'Discord channel connected to room',
      roomId,
      channelId
    });
  } catch (error) {
    console.error('Error connecting Discord channel to room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect channel to room',
      message: error.message
    });
  }
});

// Relay endpoint for receiving messages from federation registry
app.post('/api/cross-platform/relay', async (req, res) => {
  try {
    const { roomId, message } = req.body;

    if (!roomId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Room ID and message are required'
      });
    }

    // Find Discord binding for this room
    const binding = await DiscordBinding.findByRoomId(roomId);
    let channelId = null;

    if (binding) {
      channelId = binding.discordChannelId;
    } else {
      // Check in-memory map as fallback
      channelId = discordChannels.get(roomId);
      if (!channelId) {
        return res.status(404).json({
          success: false,
          error: 'No Discord channel connected to this room'
        });
      }
    }

    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot not available'
      });
    }

    // Get the Discord channel
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      // Mark binding as invalid if it exists
      if (binding) {
        binding.isValid = false;
        await binding.save();
      }

      return res.status(404).json({
        success: false,
        error: 'Discord channel not found or not text-based'
      });
    }

    // Don't relay messages that originated from Discord to avoid loops
    if (message.from?.platform === 'discord') {
      return res.json({
        success: true,
        message: 'Message originated from Discord, skipping relay to avoid loop'
      });
    }

    // Format message for Discord
    const platformEmoji = message.from?.platform === 'sociality' ? '🌐' :
                         message.from?.platform === 'telegram' ? '📱' : '🎮';

    const formattedMessage =
      `${platformEmoji} **${message.from?.displayName || 'Unknown User'}** (${message.from?.platform || 'unknown'}):\n` +
      `${message.text}`;

    // Send message to Discord channel
    await channel.send(formattedMessage);

    console.log(`📨 Relayed message to Discord channel ${channelId} in room ${roomId}`);

    res.json({
      success: true,
      message: 'Message relayed to Discord'
    });
  } catch (error) {
    console.error('Error relaying message to Discord:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to relay message to Discord',
      message: error.message
    });
  }
});

// Get connected rooms
app.get('/rooms', (req, res) => {
  try {
    const rooms = Array.from(discordChannels.entries()).map(([roomId, channelId]) => ({
      roomId,
      channelId,
      platform: 'discord'
    }));

    res.json({
      success: true,
      rooms
    });
  } catch (error) {
    console.error('Error fetching Discord rooms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rooms',
      message: error.message
    });
  }
});

// Send a message to a Discord channel (for testing)
app.post('/send-message', async (req, res) => {
  try {
    const { channelId, message } = req.body;

    if (!channelId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Channel ID and message are required'
      });
    }

    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot not available'
      });
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return res.status(404).json({
        success: false,
        error: 'Discord channel not found or not text-based'
      });
    }

    await channel.send(message);

    res.json({
      success: true,
      message: 'Message sent to Discord channel'
    });
  } catch (error) {
    console.error('Error sending message to Discord:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message to Discord',
      message: error.message
    });
  }
});

// Register with federation registry
const registerWithFederation = async () => {
  try {
    await axios.post(`${FEDERATION_REGISTRY_URL}/federation/peers`, {
      name: 'discord',
      url: PLATFORM_URL
    });
    console.log('✅ Registered Discord service with federation registry');

    // Re-register all existing rooms after peer registration
    await reRegisterExistingRooms();
  } catch (error) {
    console.warn('⚠️ Failed to register with federation registry:', error.message);
  }
};

// Re-register all existing rooms with federation registry
const reRegisterExistingRooms = async () => {
  try {
    // Get all existing discord bindings from database
    const DiscordBinding = (await import('../models/discordBindingModel.js')).default;
    const bindings = await DiscordBinding.find({});

    console.log(`🔄 Re-registering ${bindings.length} existing Discord rooms with federation registry`);

    for (const binding of bindings) {
      try {
        await axios.post(`${FEDERATION_REGISTRY_URL}/federation/rooms`, {
          roomId: binding.roomId,
          name: `Discord Room ${binding.roomId}`,
          peerUrl: PLATFORM_URL
        });
        console.log(`✅ Re-registered room ${binding.roomId} with federation registry`);
      } catch (error) {
        console.warn(`⚠️ Failed to re-register room ${binding.roomId}:`, error.message);
      }
    }

    console.log(`🎯 Completed re-registration of ${bindings.length} Discord rooms`);
  } catch (error) {
    console.warn('⚠️ Failed to re-register existing rooms:', error.message);
  }
};

// Start the Discord service
const startDiscordService = () => {
  app.listen(PORT, () => {
    console.log(`🎮 Discord Service running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);

    // Register with federation registry after a short delay
    setTimeout(registerWithFederation, 2000);
  });
};

// Export for use in main server
export { app as discordApp, startDiscordService };
export default app;
