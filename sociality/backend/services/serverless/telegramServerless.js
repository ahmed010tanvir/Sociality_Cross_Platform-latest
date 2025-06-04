import TelegramBot from 'node-telegram-bot-api';
import TelegramBinding from '../../models/telegramBindingModel.js';
import axios from 'axios';

// Telegram bot configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const FEDERATION_REGISTRY_URL = process.env.FEDERATION_REGISTRY_URL || 'https://sociality-black.vercel.app';
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://sociality-black.vercel.app';

let telegramBot = null;
let isInitialized = false;

// Initialize Telegram bot (serverless-compatible)
export const initializeTelegramBot = async () => {
  if (isInitialized && telegramBot) {
    return telegramBot;
  }

  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN') {
    console.warn('Telegram bot token not configured');
    return null;
  }

  try {
    telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
    console.log('✅ Telegram Bot initialized');

    // Set up command handlers
    setupTelegramHandlers();
    
    isInitialized = true;
    return telegramBot;
  } catch (error) {
    console.error('Failed to initialize Telegram bot:', error);
    return null;
  }
};

// Set up Telegram bot handlers
const setupTelegramHandlers = () => {
  // Handle /start command
  telegramBot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    telegramBot.sendMessage(chatId,
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
  telegramBot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    telegramBot.sendMessage(chatId,
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

  // Handle /bind and /join commands
  telegramBot.onText(/\/(bind|join) (.+)/, async (msg, match) => {
    await handleRoomBinding(msg, match);
  });

  // Handle /status command
  telegramBot.onText(/\/status/, async (msg) => {
    await handleStatusCommand(msg);
  });

  // Handle /leave command
  telegramBot.onText(/\/leave/, async (msg) => {
    await handleLeaveCommand(msg);
  });

  // Handle regular messages
  telegramBot.on('message', async (msg) => {
    await handleTelegramMessage(msg);
  });
};

// Handle room binding
const handleRoomBinding = async (msg, match) => {
  try {
    const chatId = msg.chat.id;
    const roomId = match[2].trim();
    const username = msg.from.username || msg.from.first_name || 'Unknown User';

    if (!roomId) {
      await telegramBot.sendMessage(chatId, '❌ Please provide a room ID. Example: /bind test-room-123');
      return;
    }

    // Check if chat is already bound
    const existingBinding = await TelegramBinding.findOne({ telegramChatId: chatId });
    if (existingBinding) {
      await telegramBot.sendMessage(chatId, 
        `❌ This chat is already connected to room: ${existingBinding.roomId}\n` +
        'Use /leave first to disconnect, then try again.'
      );
      return;
    }

    // Create new binding
    const binding = new TelegramBinding({
      roomId,
      telegramChatId: chatId,
      telegramChatType: msg.chat.type,
      telegramChatTitle: msg.chat.title || `Chat with ${username}`,
      createdBy: {
        telegramUserId: msg.from.id,
        telegramUsername: username,
        telegramFirstName: msg.from.first_name,
        telegramLastName: msg.from.last_name
      }
    });

    await binding.save();

    await telegramBot.sendMessage(chatId,
      `✅ Successfully joined room: ${roomId}\n\n` +
      '🌐 Messages sent here will now be shared with Discord and Sociality users!\n' +
      '📱 Start chatting to connect with users on other platforms.'
    );

    console.log(`📱 Telegram chat ${chatId} joined room ${roomId}`);
  } catch (error) {
    console.error('Error handling Telegram room binding:', error);
    await telegramBot.sendMessage(msg.chat.id, '❌ Failed to join room. Please try again.');
  }
};

// Handle status command
const handleStatusCommand = async (msg) => {
  try {
    const chatId = msg.chat.id;
    const binding = await TelegramBinding.findOne({ telegramChatId: chatId });

    if (binding) {
      await telegramBot.sendMessage(chatId,
        `✅ Connected to room: ${binding.roomId}\n` +
        `📅 Connected since: ${binding.createdAt.toLocaleString()}\n` +
        `💬 Messages sent: ${binding.messageCount || 0}`
      );
    } else {
      await telegramBot.sendMessage(chatId,
        '❌ This chat is not connected to any cross-platform room.\n' +
        'Use /bind <room-id> to connect to a room.'
      );
    }
  } catch (error) {
    console.error('Error handling Telegram status command:', error);
    await telegramBot.sendMessage(msg.chat.id, '❌ Failed to check status. Please try again.');
  }
};

// Handle leave command
const handleLeaveCommand = async (msg) => {
  try {
    const chatId = msg.chat.id;
    const binding = await TelegramBinding.findOne({ telegramChatId: chatId });

    if (!binding) {
      await telegramBot.sendMessage(chatId, '❌ This chat is not connected to any room.');
      return;
    }

    await TelegramBinding.deleteOne({ telegramChatId: chatId });
    await telegramBot.sendMessage(chatId, '✅ Successfully left the cross-platform room.');
    console.log(`📱 Telegram chat ${chatId} left room ${binding.roomId}`);
  } catch (error) {
    console.error('Error handling Telegram leave command:', error);
    await telegramBot.sendMessage(msg.chat.id, '❌ Failed to leave room. Please try again.');
  }
};

// Handle incoming Telegram messages
export const handleTelegramMessage = async (msg) => {
  try {
    // Skip commands and non-text messages
    if (!msg.text || msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name || 'Unknown User';

    // Check if this chat is bound to a room
    const binding = await TelegramBinding.findOne({ telegramChatId: chatId });
    if (!binding) return;

    const roomId = binding.roomId;

    // Prepare message for federation
    const federatedMessage = {
      from: {
        userId: msg.from.id.toString(),
        displayName: msg.from.first_name || username,
        platform: 'telegram'
      },
      text: msg.text,
      sentAt: new Date()
    };

    console.log(`📨 Received message from ${username} in chat ${chatId} for room ${roomId}: "${msg.text}"`);

    // Relay message to federation registry
    try {
      await axios.post(`${FEDERATION_REGISTRY_URL}/api/cross-platform/relay-message`, {
        roomId,
        message: federatedMessage,
        originatingPlatform: 'telegram'
      });

      console.log(`📤 Message from ${username} relayed to federation for room ${roomId}`);

      // Update binding message count
      binding.messageCount = (binding.messageCount || 0) + 1;
      binding.lastMessageAt = new Date();
      await binding.save();
    } catch (error) {
      console.error('Failed to relay Telegram message:', error.message);
    }
  } catch (error) {
    console.error('Error handling Telegram message:', error);
  }
};

// Send message to Telegram chat
export const sendTelegramMessage = async (roomId, message) => {
  try {
    if (!telegramBot) {
      await initializeTelegramBot();
    }

    if (!telegramBot) {
      throw new Error('Telegram bot not initialized');
    }

    // Find Telegram binding for this room
    const binding = await TelegramBinding.findOne({ roomId });
    if (!binding) {
      throw new Error('No Telegram chat connected to this room');
    }

    // Don't relay messages that originated from Telegram
    if (message.from?.platform === 'telegram') {
      return { success: true, message: 'Skipped - message originated from Telegram' };
    }

    // Format message for Telegram
    const platformEmoji = message.from?.platform === 'sociality' ? '🌐' :
                         message.from?.platform === 'discord' ? '🎮' : '📱';

    const formattedMessage = `${platformEmoji} ${message.from?.displayName || 'Unknown User'}:\n${message.text}`;

    // Send message to Telegram chat
    await telegramBot.sendMessage(binding.telegramChatId, formattedMessage);

    console.log(`📨 Relayed message to Telegram chat ${binding.telegramChatId} in room ${roomId}`);

    return { success: true };
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    throw error;
  }
};

// Get Telegram bot status
export const getTelegramStatus = () => {
  return {
    initialized: isInitialized,
    connected: telegramBot !== null,
    polling: telegramBot?.isPolling() || false
  };
};
