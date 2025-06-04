import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } from 'discord.js';
import DiscordBinding from '../../models/discordBindingModel.js';
import axios from 'axios';

// Discord bot configuration
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const FEDERATION_REGISTRY_URL = process.env.FEDERATION_REGISTRY_URL || 'https://sociality-black.vercel.app';
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://sociality-black.vercel.app';

let discordClient = null;
let isInitialized = false;

// Initialize Discord bot (serverless-compatible)
export const initializeDiscordBot = async () => {
  if (isInitialized && discordClient) {
    return discordClient;
  }

  if (!DISCORD_BOT_TOKEN || DISCORD_BOT_TOKEN === 'YOUR_DISCORD_BOT_TOKEN') {
    console.warn('Discord bot token not configured');
    return null;
  }

  try {
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    // Set up event handlers
    discordClient.once('ready', () => {
      console.log(`✅ Discord bot logged in as ${discordClient.user.tag}`);
      registerSlashCommands();
    });

    // Handle incoming messages
    discordClient.on('messageCreate', async (message) => {
      await handleDiscordMessage(message);
    });

    // Handle slash commands
    discordClient.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      if (interaction.commandName === 'join') {
        await handleJoinCommand(interaction);
      } else if (interaction.commandName === 'leave') {
        await handleLeaveCommand(interaction);
      } else if (interaction.commandName === 'status') {
        await handleStatusCommand(interaction);
      }
    });

    // Login to Discord
    await discordClient.login(DISCORD_BOT_TOKEN);
    isInitialized = true;
    
    return discordClient;
  } catch (error) {
    console.error('Failed to initialize Discord bot:', error);
    return null;
  }
};

// Register slash commands
const registerSlashCommands = async () => {
  if (!DISCORD_CLIENT_ID) {
    console.warn('Discord client ID not configured');
    return;
  }

  const commands = [
    new SlashCommandBuilder()
      .setName('join')
      .setDescription('Join a cross-platform room')
      .addStringOption(option =>
        option.setName('roomid')
          .setDescription('The room ID to join')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('leave')
      .setDescription('Leave the current cross-platform room'),
    new SlashCommandBuilder()
      .setName('status')
      .setDescription('Check cross-platform connection status'),
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

  try {
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), {
      body: commands,
    });
    console.log('✅ Discord slash commands registered');
  } catch (error) {
    console.error('Failed to register Discord slash commands:', error);
  }
};

// Handle incoming Discord messages
export const handleDiscordMessage = async (message) => {
  try {
    // Ignore bot messages and messages without content
    if (message.author.bot || !message.content) return;

    const channelId = message.channel.id;

    // Check if this channel is bound to a room
    const binding = await DiscordBinding.findOne({ discordChannelId: channelId });
    if (!binding) return;

    const roomId = binding.roomId;

    // Prepare message for federation
    const federatedMessage = {
      from: {
        userId: message.author.id,
        displayName: message.author.displayName || message.author.username,
        platform: 'discord'
      },
      text: message.content,
      sentAt: new Date()
    };

    // Relay message to federation registry
    try {
      await axios.post(`${FEDERATION_REGISTRY_URL}/api/cross-platform/relay-message`, {
        roomId,
        message: federatedMessage,
        originatingPlatform: 'discord'
      });

      console.log(`📨 Relayed Discord message from ${message.author.username} in room ${roomId}`);
    } catch (error) {
      console.error('Failed to relay Discord message:', error.message);
    }
  } catch (error) {
    console.error('Error handling Discord message:', error);
  }
};

// Send message to Discord channel
export const sendDiscordMessage = async (roomId, message) => {
  try {
    if (!discordClient) {
      await initializeDiscordBot();
    }

    if (!discordClient) {
      throw new Error('Discord bot not initialized');
    }

    // Find Discord binding for this room
    const binding = await DiscordBinding.findOne({ roomId });
    if (!binding) {
      throw new Error('No Discord channel connected to this room');
    }

    const channel = await discordClient.channels.fetch(binding.discordChannelId);
    if (!channel) {
      throw new Error('Discord channel not found');
    }

    // Format message for Discord
    const platformEmoji = message.from?.platform === 'sociality' ? '🌐' :
                         message.from?.platform === 'telegram' ? '📱' : '🎮';

    const formattedMessage = `${platformEmoji} **${message.from?.displayName || 'Unknown User'}**: ${message.text}`;

    await channel.send(formattedMessage);
    console.log(`📨 Sent message to Discord channel ${binding.discordChannelId} in room ${roomId}`);

    return { success: true };
  } catch (error) {
    console.error('Error sending Discord message:', error);
    throw error;
  }
};

// Handle /join command
const handleJoinCommand = async (interaction) => {
  try {
    const roomId = interaction.options.getString('roomid');
    const channelId = interaction.channel.id;
    const guildId = interaction.guild?.id;

    // Check if channel is already bound
    const existingBinding = await DiscordBinding.findOne({ discordChannelId: channelId });
    if (existingBinding) {
      await interaction.reply('❌ This channel is already connected to a room. Use /leave first.');
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
        discordUserId: interaction.user.id,
        discordUsername: interaction.user.username,
        discordDisplayName: interaction.user.displayName || interaction.user.username
      }
    });

    await binding.save();

    await interaction.reply(`✅ Successfully joined room: ${roomId}\nMessages in this channel will now be shared across platforms.`);
    console.log(`🎮 Discord channel ${channelId} joined room ${roomId}`);
  } catch (error) {
    console.error('Error handling Discord join command:', error);
    await interaction.reply('❌ Failed to join room. Please try again.');
  }
};

// Handle /leave command
const handleLeaveCommand = async (interaction) => {
  try {
    const channelId = interaction.channel.id;

    const binding = await DiscordBinding.findOne({ discordChannelId: channelId });
    if (!binding) {
      await interaction.reply('❌ This channel is not connected to any room.');
      return;
    }

    await DiscordBinding.deleteOne({ discordChannelId: channelId });
    await interaction.reply('✅ Successfully left the cross-platform room.');
    console.log(`🎮 Discord channel ${channelId} left room ${binding.roomId}`);
  } catch (error) {
    console.error('Error handling Discord leave command:', error);
    await interaction.reply('❌ Failed to leave room. Please try again.');
  }
};

// Handle /status command
const handleStatusCommand = async (interaction) => {
  try {
    const channelId = interaction.channel.id;
    const binding = await DiscordBinding.findOne({ discordChannelId: channelId });

    if (binding) {
      await interaction.reply(`✅ Connected to room: ${binding.roomId}\nCreated: ${binding.createdAt.toLocaleString()}`);
    } else {
      await interaction.reply('❌ This channel is not connected to any cross-platform room.\nUse `/join <room-id>` to connect.');
    }
  } catch (error) {
    console.error('Error handling Discord status command:', error);
    await interaction.reply('❌ Failed to check status. Please try again.');
  }
};

// Get Discord bot status
export const getDiscordStatus = () => {
  return {
    initialized: isInitialized,
    connected: discordClient?.isReady() || false,
    user: discordClient?.user?.tag || null
  };
};
