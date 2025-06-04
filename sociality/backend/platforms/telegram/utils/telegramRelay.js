const TelegramBinding = require('../models/TelegramBinding');

// Relay message to Telegram
async function relayMessageToTelegram(bot, roomId, message, roomToChatMap) {
  try {
    // Find Telegram chat bound to this room
    const binding = await TelegramBinding.findOne({
      $or: [
        { platformRoomId: roomId },
        { roomId: roomId }
      ]
    });

    if (!binding) {
      // Check in-memory map as fallback
      const chatId = roomToChatMap.get(roomId);
      if (!chatId) {
        console.log(`No Telegram binding found for room ${roomId}`);
        return;
      }

      // Send message using in-memory mapping
      const formattedMessage = formatMessageForTelegram(message);
      await bot.sendMessage(chatId, formattedMessage);
      console.log(`Message relayed to Telegram chat ${chatId} via in-memory mapping`);
      return;
    }

    // Send message using database binding
    const formattedMessage = formatMessageForTelegram(message);
    await bot.sendMessage(binding.telegramChatId, formattedMessage);

    // Update last used timestamp
    binding.lastUsedAt = new Date();
    await binding.save();

    console.log(`Message relayed to Telegram chat ${binding.telegramChatId} for room ${roomId}`);
  } catch (error) {
    console.error('Error relaying message to Telegram:', error.message);
    throw error;
  }
}

// Format message for Telegram display
function formatMessageForTelegram(message) {
  const platform = message.from?.platform || 'unknown';
  const displayName = message.from?.displayName || message.from?.username || message.from?.userId || 'Unknown User';
  const platformEmoji = getPlatformEmoji(platform);

  return `${platformEmoji} **${displayName}**: ${message.text}`;
}

// Get emoji for platform
function getPlatformEmoji(platform) {
  const emojiMap = {
    'sociality': '🌐',
    'platform-a': '🌐',
    'discord': '🎮',
    'platform-c': '🎮',
    'telegram': '📱',
    'platform-b': '📱',
    'web': '💻',
    'mobile': '📱'
  };

  return emojiMap[platform] || '💬';
}

// Validate Telegram binding
async function validateTelegramBinding(bot, binding) {
  try {
    // Try to get chat info to validate the binding
    const chat = await bot.getChat(binding.telegramChatId);

    if (chat) {
      binding.isValid = true;
      binding.lastValidatedAt = new Date();
      await binding.save();
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Telegram binding validation failed for chat ${binding.telegramChatId}:`, error.message);

    // Mark binding as invalid
    binding.isValid = false;
    binding.lastValidatedAt = new Date();
    await binding.save();

    return false;
  }
}

// Load all Telegram bindings and validate them
async function loadAndValidateTelegramBindings(bot, chatToRoomMap, roomToChatMap) {
  try {
    const bindings = await TelegramBinding.find({ isValid: true });

    console.log(`Loading ${bindings.length} Telegram bindings...`);

    for (const binding of bindings) {
      // Add to in-memory maps
      chatToRoomMap.set(binding.telegramChatId, binding.roomId || binding.platformRoomId);
      roomToChatMap.set(binding.roomId || binding.platformRoomId, binding.telegramChatId);

      // Validate binding in background
      validateTelegramBinding(bot, binding).catch(error => {
        console.error(`Background validation failed for binding ${binding._id}:`, error.message);
      });
    }

    console.log(`Loaded ${bindings.length} Telegram bindings into memory`);
  } catch (error) {
    console.error('Error loading Telegram bindings:', error.message);
  }
}

module.exports = {
  relayMessageToTelegram,
  formatMessageForTelegram,
  getPlatformEmoji,
  validateTelegramBinding,
  loadAndValidateTelegramBindings
};
