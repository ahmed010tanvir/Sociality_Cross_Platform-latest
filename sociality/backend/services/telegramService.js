import express from 'express';
import cors from 'cors';
import axios from 'axios';
import TelegramBot from 'node-telegram-bot-api';
import TelegramBinding from '../models/telegramBindingModel.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from the main .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.TELEGRAM_PORT || 7301;

// Middleware
app.use(cors());
app.use(express.json());

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const FEDERATION_REGISTRY_URL = process.env.FEDERATION_REGISTRY_URL || 'http://localhost:7300';
const PLATFORM_URL = process.env.TELEGRAM_PLATFORM_URL || 'http://localhost:7301';

// Initialize Telegram Bot (only if token is provided)
let bot = null;
const telegramChats = new Map(); // Map room IDs to Telegram chat IDs
const roomMappings = new Map(); // Map Telegram chat IDs to room IDs

if (TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN !== 'YOUR_TELEGRAM_BOT_TOKEN') {
  try {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
    console.log('✅ Telegram Bot initialized');

    // Note: Main message handler is defined later to avoid conflicts

    // Handle /start command
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      bot.sendMessage(chatId,
        '🤖 Welcome to Sociality Cross-Platform Messaging!\n\n' +
        'This bot connects your Telegram chat to the Sociality platform.\n' +
        'Messages sent here will be relayed to Discord and web users.\n\n' +
        'Commands:\n' +
        '/bind <room-id> - Connect to a cross-platform room\n' +
        '/help - Show this help message\n' +
        '/status - Check connection status\n' +
        '/leave - Disconnect from current room'
      );
    });

    // Handle /help command
    bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      bot.sendMessage(chatId,
        '📋 Available Commands:\n\n' +
        '/start - Initialize the bot\n' +
        '/bind <room-id> - Connect to a cross-platform room\n' +
        '/join <room-id> - Same as /bind (alias)\n' +
        '/leave - Disconnect from current room\n' +
        '/status - Check connection status\n' +
        '/help - Show this help message\n\n' +
        '💬 After binding to a room, just send regular messages to chat with users on other platforms!\n\n' +
        '🌐 Example: /bind test-room-123'
      );
    });

    // Handle /join command (alias for /bind)
    bot.onText(/\/join (.+)/, async (msg, match) => {
      await handleRoomBinding(msg, match);
    });

    // Handle /bind command (primary command)
    bot.onText(/\/bind (.+)/, async (msg, match) => {
      await handleRoomBinding(msg, match);
    });

    // Common function to handle room binding
    async function handleRoomBinding(msg, match) {
      const chatId = msg.chat.id;
      const roomId = match[1].trim();

      try {
        // Check if this Telegram chat is already bound to a room
        const existingBinding = await TelegramBinding.findByTelegramChatId(chatId.toString());
        if (existingBinding) {
          bot.sendMessage(chatId,
            `❌ This Telegram chat is already connected to room: ${existingBinding.roomId}\n\n` +
            `Use /leave to disconnect first, then try joining a new room.`
          );
          return;
        }

        // Check if the room is already bound to another Telegram chat
        const roomBinding = await TelegramBinding.findByRoomId(roomId);
        if (roomBinding) {
          bot.sendMessage(chatId,
            `❌ Room ${roomId} is already connected to another Telegram chat.\n\n` +
            `Each room can only be bound to one Telegram chat at a time.`
          );
          return;
        }

        // Create new binding
        const binding = new TelegramBinding({
          roomId,
          telegramChatId: chatId.toString(),
          telegramChatType: msg.chat.type,
          telegramChatTitle: msg.chat.title || null,
          createdBy: {
            telegramUserId: msg.from.id.toString(),
            telegramUsername: msg.from.username || null,
            telegramFirstName: msg.from.first_name,
            telegramLastName: msg.from.last_name || null
          }
        });

        await binding.save();

        // Update in-memory mappings
        telegramChats.set(roomId, chatId.toString());
        roomMappings.set(chatId, roomId);

        // Register room with federation registry
        try {
          await axios.post(`${FEDERATION_REGISTRY_URL}/federation/rooms`, {
            roomId,
            name: `Telegram Room ${roomId}`,
            peerUrl: PLATFORM_URL
          });
          console.log(`✅ Registered room ${roomId} with federation registry`);
        } catch (federationError) {
          console.warn(`⚠️ Failed to register room with federation:`, federationError.message);
        }

        bot.sendMessage(chatId,
          `✅ Successfully connected to cross-platform room!\n\n` +
          `🏠 Room ID: ${roomId}\n` +
          `💬 Messages in this chat will now be shared with users on other platforms.\n` +
          `📱 Users on Sociality web app and Discord can now chat with you!\n\n` +
          `Commands:\n` +
          `/status - Check connection status\n` +
          `/leave - Disconnect from the room`
        );

        console.log(`🔗 Telegram chat ${chatId} bound to room ${roomId}`);
      } catch (error) {
        console.error('Error binding room:', error);
        bot.sendMessage(chatId, `❌ Failed to bind room: ${error.message}`);
      }
    }

    // Handle /leave command
    bot.onText(/\/leave/, async (msg) => {
      const chatId = msg.chat.id;

      try {
        const binding = await TelegramBinding.findByTelegramChatId(chatId.toString());
        if (!binding) {
          bot.sendMessage(chatId, `❌ This chat is not connected to any room.`);
          return;
        }

        const roomId = binding.roomId;

        // Deactivate binding
        await binding.deactivate();

        // Remove from in-memory mappings
        telegramChats.delete(roomId);
        roomMappings.delete(chatId);

        bot.sendMessage(chatId,
          `✅ Successfully disconnected from room ${roomId}.\n\n` +
          `You can join a new room using /join <room_id>`
        );

        console.log(`🔌 Telegram chat ${chatId} left room ${roomId}`);
      } catch (error) {
        console.error('Error leaving room:', error);
        bot.sendMessage(chatId, `❌ Failed to leave room: ${error.message}`);
      }
    });

    // Handle /status command
    bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id;

      try {
        const binding = await TelegramBinding.findByTelegramChatId(chatId.toString());

        let statusMessage = '📊 Connection Status:\n\n';
        statusMessage += `🔗 Chat ID: ${chatId}\n`;
        statusMessage += `🏠 Room ID: ${binding ? binding.roomId : 'Not connected to a room'}\n`;

        if (binding) {
          statusMessage += `📅 Connected since: ${binding.createdAt.toLocaleDateString()}\n`;
          statusMessage += `💬 Messages sent: ${binding.messageCount}\n`;
          statusMessage += `🕐 Last activity: ${binding.lastMessageAt.toLocaleString()}\n`;
        }

        try {
          const response = await axios.get(`${FEDERATION_REGISTRY_URL}/health`);
          statusMessage += `🌐 Federation Registry: ✅ Online\n`;
        } catch (error) {
          statusMessage += `🌐 Federation Registry: ❌ Offline\n`;
        }

        bot.sendMessage(chatId, statusMessage);
      } catch (error) {
        console.error('Error getting status:', error);
        bot.sendMessage(chatId, `❌ Failed to get status: ${error.message}`);
      }
    });

    // Handle regular messages (the missing piece!)
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
        // Find binding for this chat
        const binding = await TelegramBinding.findByTelegramChatId(chatId.toString());
        if (!binding) {
          console.log(`⚠️ No room binding found for Telegram chat ${chatId}`);
          return; // Not connected to a room, ignore message
        }

        const roomId = binding.roomId;

        // Store user info
        const username = msg.from.username || msg.from.first_name || 'Unknown User';

        // Prepare message for federation with correct structure
        const federatedMessage = {
          id: msg.message_id.toString(),
          text: msg.text,
          from: {
            userId: msg.from.id.toString(),
            displayName: username,
            username: username,
            platform: 'telegram'
          },
          sentAt: new Date(msg.date * 1000).toISOString(),
          timestamp: new Date(msg.date * 1000).toISOString(),
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

        // Update binding message count
        try {
          binding.messageCount = (binding.messageCount || 0) + 1;
          binding.lastMessageAt = new Date();
          await binding.save();
        } catch (updateError) {
          console.warn('Failed to update binding message count:', updateError.message);
        }

      } catch (error) {
        console.error('❌ Error relaying message:', error);
      }
    });

    console.log('🎯 Telegram bot event handlers registered');

  } catch (error) {
    console.warn('⚠️ Failed to initialize Telegram Bot:', error.message);
  }
} else {
  console.warn('⚠️ Telegram Bot Token not provided. Telegram integration disabled.');
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'telegram',
    timestamp: new Date().toISOString(),
    botActive: bot !== null,
    connectedChats: telegramChats.size
  });
});

// Connect a Telegram chat to a room
app.post('/connect-room', async (req, res) => {
  try {
    const { roomId, chatId } = req.body;

    if (!roomId || !chatId) {
      return res.status(400).json({
        success: false,
        error: 'Room ID and Chat ID are required'
      });
    }

    // Store the mapping
    telegramChats.set(roomId, chatId);
    roomMappings.set(chatId, roomId);

    console.log(`🔗 Connected Telegram chat ${chatId} to room ${roomId}`);

    // Send confirmation message to Telegram chat
    if (bot) {
      try {
        await bot.sendMessage(chatId,
          `🎉 Successfully connected to cross-platform room!\n\n` +
          `🏠 Room ID: ${roomId}\n` +
          `💬 You can now chat with users from other platforms.`
        );
      } catch (error) {
        console.warn('Failed to send confirmation to Telegram:', error.message);
      }
    }

    res.json({
      success: true,
      message: 'Telegram chat connected to room',
      roomId,
      chatId
    });
  } catch (error) {
    console.error('Error connecting Telegram chat to room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect chat to room',
      message: error.message
    });
  }
});

// Relay endpoint for receiving messages from Sociality
app.post('/api/cross-platform/relay', async (req, res) => {
  try {
    const { roomId, message } = req.body;

    if (!roomId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Room ID and message are required'
      });
    }

    // Find binding for this room
    const binding = await TelegramBinding.findByRoomId(roomId);
    if (!binding) {
      return res.status(404).json({
        success: false,
        error: 'No Telegram chat connected to this room'
      });
    }

    if (!bot) {
      return res.status(503).json({
        success: false,
        error: 'Telegram bot not available'
      });
    }

    // Don't relay messages that originated from Telegram
    if (message.from?.platform === 'telegram') {
      return res.json({
        success: true,
        message: 'Skipped - message originated from Telegram'
      });
    }

    // Format message for Telegram
    const platformEmoji = message.from?.platform === 'sociality' ? '🌐' :
                         message.from?.platform === 'discord' ? '🎮' : '📱';

    const formattedMessage =
      `${platformEmoji} ${message.from?.displayName || 'Unknown User'}:\n` +
      `${message.text}`;

    // Send message to Telegram chat
    await bot.sendMessage(binding.telegramChatId, formattedMessage);

    console.log(`📨 Relayed message to Telegram chat ${binding.telegramChatId} in room ${roomId}`);

    res.json({
      success: true,
      message: 'Message relayed to Telegram'
    });
  } catch (error) {
    console.error('Error relaying message to Telegram:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to relay message to Telegram',
      message: error.message
    });
  }
});

// Get connected rooms
app.get('/rooms', (req, res) => {
  try {
    const rooms = Array.from(telegramChats.entries()).map(([roomId, chatId]) => ({
      roomId,
      chatId,
      platform: 'telegram'
    }));

    res.json({
      success: true,
      rooms
    });
  } catch (error) {
    console.error('Error fetching Telegram rooms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rooms',
      message: error.message
    });
  }
});

// Register with federation registry
const registerWithFederation = async () => {
  try {
    await axios.post(`${FEDERATION_REGISTRY_URL}/federation/peers`, {
      name: 'telegram',
      url: PLATFORM_URL
    });
    console.log('✅ Registered Telegram service with federation registry');

    // Re-register all existing rooms after peer registration
    await reRegisterExistingRooms();
  } catch (error) {
    console.warn('⚠️ Failed to register with federation registry:', error.message);
  }
};

// Re-register all existing rooms with federation registry
const reRegisterExistingRooms = async () => {
  try {
    // Get all existing telegram bindings from database
    const TelegramBinding = (await import('../models/telegramBindingModel.js')).default;
    const bindings = await TelegramBinding.find({});

    console.log(`🔄 Re-registering ${bindings.length} existing Telegram rooms with federation registry`);

    for (const binding of bindings) {
      try {
        await axios.post(`${FEDERATION_REGISTRY_URL}/federation/rooms`, {
          roomId: binding.roomId,
          name: `Telegram Room ${binding.roomId}`,
          peerUrl: PLATFORM_URL
        });
        console.log(`✅ Re-registered room ${binding.roomId} with federation registry`);
      } catch (error) {
        console.warn(`⚠️ Failed to re-register room ${binding.roomId}:`, error.message);
      }
    }

    console.log(`🎯 Completed re-registration of ${bindings.length} Telegram rooms`);
  } catch (error) {
    console.warn('⚠️ Failed to re-register existing rooms:', error.message);
  }
};

// Start the Telegram service
const startTelegramService = () => {
  app.listen(PORT, () => {
    console.log(`📱 Telegram Service running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);

    // Register with federation registry after a short delay
    setTimeout(registerWithFederation, 2000);
  });
};

// Export for use in main server
export { app as telegramApp, startTelegramService };
export default app;
