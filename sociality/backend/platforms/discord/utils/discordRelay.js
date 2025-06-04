const DiscordBinding = require('../models/DiscordBinding');

// Relay message to Discord
async function relayMessageToDiscord(client, roomId, message, roomToChannelMap) {
  try {
    // Find Discord channel bound to this room
    const binding = await DiscordBinding.findOne({
      $or: [
        { platformRoomId: roomId },
        { roomId: roomId }
      ]
    });

    if (!binding) {
      // Check in-memory map as fallback
      const channelId = roomToChannelMap.get(roomId);
      if (!channelId) {
        console.log(`No Discord binding found for room ${roomId}`);
        return;
      }

      // Send message using in-memory mapping
      const channel = await client.channels.fetch(channelId);
      if (channel) {
        const formattedMessage = formatMessageForDiscord(message);
        await channel.send(formattedMessage);
        console.log(`📨 Message relayed to Discord channel ${channelId} via in-memory mapping from ${message.from?.platform || 'unknown'}`);
      }
      return;
    }

    // Send message using database binding
    const channel = await client.channels.fetch(binding.discordChannelId);
    if (!channel) {
      console.log(`Discord channel ${binding.discordChannelId} not found`);
      return;
    }

    const formattedMessage = formatMessageForDiscord(message);
    await channel.send(formattedMessage);

    // Update last used timestamp
    binding.lastUsedAt = new Date();
    await binding.save();

    console.log(`📨 Message relayed to Discord channel ${binding.discordChannelId} for room ${roomId} from ${message.from?.platform || 'unknown'}`);
  } catch (error) {
    console.error('❌ Error relaying message to Discord:', error.message);
    throw error;
  }
}

// Format message for Discord display
function formatMessageForDiscord(message) {
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
    'telegram': '📱',
    'platform-b': '📱',
    'discord': '🎮',
    'platform-c': '🎮',
    'web': '💻',
    'mobile': '📱'
  };

  return emojiMap[platform] || '💬';
}

// Validate Discord binding
async function validateDiscordBinding(client, binding) {
  try {
    // Try to fetch channel to validate the binding
    const channel = await client.channels.fetch(binding.discordChannelId);

    if (channel) {
      binding.isValid = true;
      binding.lastValidatedAt = new Date();
      await binding.save();
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Discord binding validation failed for channel ${binding.discordChannelId}:`, error.message);

    // Mark binding as invalid
    binding.isValid = false;
    binding.lastValidatedAt = new Date();
    await binding.save();

    return false;
  }
}

// Load all Discord bindings and validate them
async function loadAndValidateDiscordBindings(client, channelToRoomMap, roomToChannelMap) {
  try {
    const bindings = await DiscordBinding.find({ isValid: true });

    console.log(`Loading ${bindings.length} Discord bindings...`);

    for (const binding of bindings) {
      // Add to in-memory maps
      const roomId = binding.roomId || binding.platformRoomId;
      channelToRoomMap.set(binding.discordChannelId, roomId);
      roomToChannelMap.set(roomId, binding.discordChannelId);

      // Validate binding in background
      validateDiscordBinding(client, binding).catch(error => {
        console.error(`Background validation failed for binding ${binding._id}:`, error.message);
      });
    }

    console.log(`Loaded ${bindings.length} Discord bindings into memory`);
  } catch (error) {
    console.error('Error loading Discord bindings:', error.message);
  }
}

module.exports = {
  relayMessageToDiscord,
  formatMessageForDiscord,
  getPlatformEmoji,
  validateDiscordBinding,
  loadAndValidateDiscordBindings
};
