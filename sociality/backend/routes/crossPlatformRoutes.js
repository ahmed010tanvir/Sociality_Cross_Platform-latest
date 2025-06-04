import express from "express";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import Room from "../models/roomModel.js";
import CrossPlatformMessage from "../models/crossPlatformMessageModel.js";
import TelegramBinding from "../models/telegramBindingModel.js";
import DiscordBinding from "../models/discordBindingModel.js";
import protectRoute from "../middlewares/protectRoute.js";

const router = express.Router();

// Federation Registry URL
const FEDERATION_REGISTRY_URL = process.env.FEDERATION_REGISTRY_URL || 'http://localhost:7300';
const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:5000';

// Import serverless cross-platform services
import { initializeDiscordBot, sendDiscordMessage, getDiscordStatus } from '../services/serverless/discordServerless.js';
import { initializeTelegramBot, sendTelegramMessage, getTelegramStatus } from '../services/serverless/telegramServerless.js';
import { federationRegistry, initializeFederationRegistry } from '../services/serverless/federationServerless.js';

// Initialize serverless cross-platform services
let servicesInitialized = false;

const initializeServices = async () => {
  if (servicesInitialized) return;

  try {
    console.log('🚀 Initializing serverless cross-platform services...');

    // Initialize federation registry
    initializeFederationRegistry();

    // Initialize Discord bot
    await initializeDiscordBot();

    // Initialize Telegram bot
    await initializeTelegramBot();

    servicesInitialized = true;
    console.log('✅ Serverless cross-platform services initialized');
  } catch (error) {
    console.error('❌ Failed to initialize cross-platform services:', error);
  }
};

// Register platform with federation registry
const registerWithFederation = async () => {
  try {
    await axios.post(`${FEDERATION_REGISTRY_URL}/federation/peers`, {
      name: 'sociality',
      url: PLATFORM_URL
    });
    console.log('✅ Registered with federation registry');
  } catch (error) {
    console.warn('⚠️ Failed to register with federation registry:', error.message);
  }
};

// Create a cross-platform room with UUID
router.post("/rooms", protectRoute, async (req, res) => {
  try {
    const { name, allowedPlatforms = ['sociality', 'telegram', 'discord'] } = req.body;
    const userId = req.user?._id;
    const username = req.user?.username;

    console.log('Creating cross-platform room:', { name, userId, username, allowedPlatforms });

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Room name is required'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Generate UUID for cross-platform room
    const roomId = uuidv4();

    // Create room in local database (private by default)
    const room = new Room({
      roomId,
      name,
      creator: userId,
      participants: userId ? [{ user: userId, role: 'admin' }] : [],
      settings: {
        isPrivate: true,
        requireApproval: false,
        maxParticipants: 100
      },
      federationSettings: {
        isEnabled: true,
        allowedPlatforms,
        registeredPeers: [],
        lastSyncAt: new Date()
      }
    });

    await room.save();
    console.log('Room saved to database:', { roomId, name, creator: userId });

    // Register room with federation registry
    try {
      const federationResponse = await axios.post(`${FEDERATION_REGISTRY_URL}/federation/rooms`, {
        roomId,
        name,
        peerUrl: PLATFORM_URL
      });
      console.log('Room registered with federation registry:', federationResponse.data);
    } catch (federationError) {
      console.warn('Failed to register room with federation registry:', federationError.message);
    }

    const responseData = {
      success: true,
      room: {
        roomId,
        name,
        creator: userId,
        federationSettings: room.federationSettings
      }
    };

    console.log('Sending room creation response:', responseData);
    res.status(201).json(responseData);
  } catch (error) {
    console.error('Error creating cross-platform room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create cross-platform room',
      message: error.message
    });
  }
});

// Get cross-platform rooms for authenticated user
router.get("/rooms", protectRoute, async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get local rooms where user is a participant and federation is enabled
    const userRooms = await Room.find({
      'federationSettings.isEnabled': true,
      'participants.user': userId
    })
      .populate('creator', 'username name profilePic')
      .lean();

    // Format rooms for response
    const formattedRooms = userRooms.map(room => ({
      roomId: room.roomId,
      name: room.name,
      creator: room.creator,
      peers: room.federationSettings.registeredPeers || [],
      participantCount: room.participants?.length || 0,
      isPrivate: room.settings?.isPrivate || false,
      lastActivity: room.lastActivity
    }));

    res.json({
      success: true,
      rooms: formattedRooms
    });
  } catch (error) {
    console.error('Error fetching cross-platform rooms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cross-platform rooms',
      message: error.message
    });
  }
});

// Join a cross-platform room by room ID
router.post("/rooms/:roomId/join", protectRoute, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?._id;
    const username = req.user?.username;

    if (!userId || !username) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Find the room locally first
    let room = await Room.findOne({ roomId });

    if (!room) {
      // For private rooms, we need to check if the room exists elsewhere
      // Try to get room info from federation registry
      try {
        const response = await axios.get(`${FEDERATION_REGISTRY_URL}/federation/rooms/${roomId}`);
        const federatedRoom = response.data;

        if (federatedRoom) {
          // Create a local copy of the federated room
          room = new Room({
            roomId,
            name: federatedRoom.name || `Room ${roomId}`,
            creator: new mongoose.Types.ObjectId('000000000000000000000000'), // System user for federated rooms
            participants: [],
            settings: {
              isPrivate: true,
              requireApproval: false,
              maxParticipants: 100
            },
            federationSettings: {
              isEnabled: true,
              allowedPlatforms: ['sociality', 'telegram', 'discord'],
              registeredPeers: federatedRoom.peers || [],
              lastSyncAt: new Date()
            }
          });
        } else {
          return res.status(404).json({
            success: false,
            error: 'Room not found. Please check the room ID.'
          });
        }
      } catch (federationError) {
        return res.status(404).json({
          success: false,
          error: 'Room not found. Please check the room ID.'
        });
      }
    }

    // Check if user is already a participant
    const existingParticipant = room.participants.find(p => p.user.toString() === userId.toString());
    if (!existingParticipant) {
      room.participants.push({ user: userId, role: 'member' });
      await room.save();
    }

    res.json({
      success: true,
      message: 'Successfully joined cross-platform room',
      room: {
        roomId: room.roomId,
        name: room.name,
        participantCount: room.participants.length,
        isPrivate: room.settings?.isPrivate || false
      }
    });
  } catch (error) {
    console.error('Error joining cross-platform room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join cross-platform room',
      message: error.message
    });
  }
});

// Delete a cross-platform room
router.delete("/rooms/:roomId", protectRoute, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Find the room
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    // Check if user is the creator or admin
    const userParticipant = room.participants.find(p => p.user.toString() === userId.toString());
    if (!userParticipant || (userParticipant.role !== 'admin' && room.creator.toString() !== userId.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Only room creators and admins can delete rooms'
      });
    }

    // Delete all messages in the room
    await CrossPlatformMessage.deleteMany({ roomId });

    // Remove room from federation registry
    try {
      await axios.delete(`${FEDERATION_REGISTRY_URL}/federation/rooms/${roomId}`);
      console.log('Room removed from federation registry');
    } catch (federationError) {
      console.warn('Failed to remove room from federation registry:', federationError.message);
    }

    // Delete the room
    await Room.deleteOne({ roomId });

    res.json({
      success: true,
      message: 'Room deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting cross-platform room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete room',
      message: error.message
    });
  }
});

// Get messages from a cross-platform room
router.get("/rooms/:roomId/messages", protectRoute, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?._id;
    const limit = parseInt(req.query.limit) || 50;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Find the room locally
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.json({
        success: true,
        messages: []
      });
    }

    // Check if user is a participant in private rooms
    if (room.settings?.isPrivate) {
      const isParticipant = room.participants.some(p => p.user.toString() === userId.toString());
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You must join this room to view messages.'
        });
      }
    }

    // Get local cross-platform messages for this room
    const localMessages = await CrossPlatformMessage.find({ roomId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Transform messages to a consistent format
    const formattedMessages = localMessages.map(msg => ({
      id: msg._id.toString(),
      text: msg.text,
      sender: {
        _id: msg.sender,
        username: msg.senderUsername,
        platform: msg.senderPlatform
      },
      timestamp: msg.createdAt,
      roomId: msg.roomId,
      platform: msg.platform
    }));

    res.json({
      success: true,
      messages: formattedMessages.reverse() // Return in chronological order
    });
  } catch (error) {
    console.error('Error fetching cross-platform room messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch room messages',
      message: error.message
    });
  }
});

// Send message to cross-platform room
router.post("/rooms/:roomId/messages", protectRoute, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { message } = req.body;
    const userId = req.user?._id;
    const username = req.user?.username;
    const displayName = req.user?.name || username;

    console.log(`Sending cross-platform message to room ${roomId}:`, { message, userId, username, displayName });

    if (!message || !userId || !username) {
      return res.status(400).json({
        success: false,
        error: 'Message and authentication are required'
      });
    }

    // Check if user has access to this room
    const room = await Room.findOne({ roomId });
    if (room && room.settings?.isPrivate) {
      const isParticipant = room.participants.some(p => p.user.toString() === userId.toString());
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You must join this room to send messages.'
        });
      }
    }

    // Prepare message for federation
    const federatedMessage = {
      from: {
        userId: userId.toString(),
        displayName,
        platform: 'sociality'
      },
      text: message,
      sentAt: new Date()
    };

    // Store the message locally first
    const localMessage = new CrossPlatformMessage({
      roomId,
      sender: userId.toString(),
      senderUsername: displayName,
      senderPlatform: 'sociality',
      text: message,
      platform: 'sociality',
      messageId: Date.now().toString()
    });
    await localMessage.save();
    console.log(`Saved local message:`, localMessage);

    // Emit the message to connected Sociality users immediately via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const socketMessage = {
        id: localMessage._id.toString(),
        text: message,
        sender: {
          _id: userId.toString(),
          username: displayName,
          platform: 'sociality'
        },
        timestamp: localMessage.createdAt.toISOString(),
        roomId,
        isCrossPlatform: true,
        platform: 'sociality'
      };

      console.log(`Emitting crossPlatformMessage to room_${roomId}:`, socketMessage);
      io.to(`room_${roomId}`).emit('crossPlatformMessage', socketMessage);
    } else {
      console.warn('Socket.IO instance not available');
    }

    // Note: Removed direct platform relay to prevent duplicate messages
    // All cross-platform communication now goes through federation registry only

    // Initialize services if not already done
    await initializeServices();

    // Send to federation registry for relay to other platforms
    try {
      // Use serverless federation registry
      const relayResults = await federationRegistry.relayMessage(roomId, federatedMessage, 'sociality');

      console.log(`Federation relay results:`, relayResults);

      res.json({
        success: true,
        message: 'Message sent to cross-platform room',
        localMessage: {
          id: localMessage._id.toString(),
          text: message,
          sender: {
            _id: userId.toString(),
            username: displayName,
            platform: 'sociality'
          },
          timestamp: localMessage.createdAt.toISOString(),
          roomId,
          platform: 'sociality'
        },
        relayResults: relayResults
      });
    } catch (relayError) {
      console.error('Failed to relay message:', relayError.message);

      // Still return success since local message was saved and emitted
      res.json({
        success: true,
        message: 'Message sent locally but failed to relay to other platforms',
        localMessage: {
          id: localMessage._id.toString(),
          text: message,
          sender: {
            _id: userId.toString(),
            username: displayName,
            platform: 'sociality'
          },
          timestamp: localMessage.createdAt.toISOString(),
          roomId,
          platform: 'sociality'
        },
        relayError: relayError.message
      });
    }
  } catch (error) {
    console.error('Error sending cross-platform message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send cross-platform message',
      message: error.message
    });
  }
});

// Relay endpoint for receiving messages from federation registry
router.post("/relay", async (req, res) => {
  try {
    const { roomId, message } = req.body;

    if (!roomId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Room ID and message are required'
      });
    }

    console.log(`📨 Received relayed message for room ${roomId} from ${message.from?.platform || 'unknown platform'}`);

    // Find the room
    let room = await Room.findOne({ roomId });

    if (!room) {
      // Create a local copy of the federated room if it doesn't exist
      // Use a system user ID for cross-platform rooms
      const systemUserId = new mongoose.Types.ObjectId('000000000000000000000000');
      room = new Room({
        roomId,
        name: `Federated Room ${roomId}`,
        creator: systemUserId,
        participants: [],
        federationSettings: {
          isEnabled: true,
          allowedPlatforms: ['sociality', 'telegram', 'discord'],
          registeredPeers: [],
          lastSyncAt: new Date()
        }
      });
      await room.save();
    }

    // Store the message locally with flexible field mapping
    const crossPlatformMessage = new CrossPlatformMessage({
      roomId,
      sender: message.from?.userId || message.from?.id || 'unknown',
      senderUsername: message.from?.displayName || message.from?.username || 'Unknown User',
      senderPlatform: message.from?.platform || 'unknown',
      text: message.text,
      platform: message.from?.platform || 'unknown',
      messageId: message.id || Date.now().toString(),
      relayedFrom: req.body.originatingPlatform
    });
    await crossPlatformMessage.save();

    // Update room's last activity
    room.lastActivity = new Date();
    room.messageCount = (room.messageCount || 0) + 1;
    await room.save();

    // Emit the message to connected Sociality users via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const socketMessage = {
        id: message.id || Date.now().toString(),
        text: message.text,
        sender: {
          _id: message.from?.userId || message.from?.id || 'unknown',
          username: message.from?.displayName || message.from?.username || 'Unknown User',
          platform: message.from?.platform || 'unknown'
        },
        timestamp: message.sentAt || message.timestamp || new Date().toISOString(),
        roomId,
        isCrossPlatform: true,
        platform: message.from?.platform || 'unknown'
      };

      console.log(`🔄 Emitting crossPlatformMessage to room_${roomId} from ${message.from?.platform}:`, socketMessage);
      io.to(`room_${roomId}`).emit('crossPlatformMessage', socketMessage);
    } else {
      console.warn('⚠️ Socket.IO instance not available for message relay');
    }

    res.json({
      success: true,
      message: 'Message relayed to Sociality users'
    });
  } catch (error) {
    console.error('Error handling relayed message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to handle relayed message',
      message: error.message
    });
  }
});

// Cross-platform relay endpoint for direct platform-to-platform communication
router.post("/relay-direct", async (req, res) => {
  try {
    const { roomId, message, originatingPlatform } = req.body;

    if (!roomId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Room ID and message are required'
      });
    }

    console.log(`📨 Received direct relay message for room ${roomId} from ${message.from?.platform || 'unknown platform'}`);

    // Skip if message is from Sociality to avoid loops
    if (message.from?.platform === 'sociality') {
      console.log('⏭️ Skipping message from Sociality to avoid loop');
      return res.json({ success: true, message: 'Message skipped (same platform)' });
    }

    // Find the room
    let room = await Room.findOne({ roomId });

    if (!room) {
      // Create a local copy of the federated room if it doesn't exist
      // Use a system user ID for cross-platform rooms
      const systemUserId = new mongoose.Types.ObjectId('000000000000000000000000');
      room = new Room({
        roomId,
        name: `Federated Room ${roomId}`,
        creator: systemUserId,
        participants: [],
        federationSettings: {
          isEnabled: true,
          allowedPlatforms: ['sociality', 'telegram', 'discord'],
          registeredPeers: [],
          lastSyncAt: new Date()
        }
      });
      await room.save();
    }

    // Store the message locally with flexible field mapping
    const crossPlatformMessage = new CrossPlatformMessage({
      roomId,
      sender: message.from?.userId || message.from?.id || 'unknown',
      senderUsername: message.from?.displayName || message.from?.username || 'Unknown User',
      senderPlatform: message.from?.platform || 'unknown',
      text: message.text,
      platform: message.from?.platform || 'unknown',
      messageId: message.id || Date.now().toString(),
      relayedFrom: originatingPlatform
    });
    await crossPlatformMessage.save();

    // Update room's last activity
    room.lastActivity = new Date();
    room.messageCount = (room.messageCount || 0) + 1;
    await room.save();

    // Emit the message to connected Sociality users via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const socketMessage = {
        id: message.id || Date.now().toString(),
        text: message.text,
        sender: {
          _id: message.from?.userId || message.from?.id || 'unknown',
          username: message.from?.displayName || message.from?.username || 'Unknown User',
          platform: message.from?.platform || 'unknown'
        },
        timestamp: message.sentAt || message.timestamp || new Date().toISOString(),
        roomId,
        isCrossPlatform: true,
        platform: message.from?.platform || 'unknown'
      };

      console.log(`🔄 Emitting crossPlatformMessage to room_${roomId} from ${message.from?.platform}:`, socketMessage);
      io.to(`room_${roomId}`).emit('crossPlatformMessage', socketMessage);
    } else {
      console.warn('⚠️ Socket.IO instance not available for message relay');
    }

    res.json({
      success: true,
      message: 'Message relayed to Sociality users'
    });
  } catch (error) {
    console.error('Error handling direct relay message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to handle direct relay message',
      message: error.message
    });
  }
});

// Get Telegram binding for a room
router.get("/rooms/:roomId/telegram", async (req, res) => {
  try {
    const { roomId } = req.params;

    const binding = await TelegramBinding.findByRoomId(roomId);

    if (!binding) {
      return res.json({
        success: true,
        bound: false,
        message: 'No Telegram chat bound to this room'
      });
    }

    res.json({
      success: true,
      bound: true,
      binding: {
        telegramChatId: binding.telegramChatId,
        telegramChatType: binding.telegramChatType,
        telegramChatTitle: binding.telegramChatTitle,
        createdAt: binding.createdAt,
        messageCount: binding.messageCount,
        lastMessageAt: binding.lastMessageAt,
        createdBy: binding.createdBy
      }
    });
  } catch (error) {
    console.error('Error getting Telegram binding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Telegram binding',
      message: error.message
    });
  }
});

// Get all Telegram bindings (admin endpoint)
router.get("/telegram/bindings", protectRoute, async (req, res) => {
  try {
    const bindings = await TelegramBinding.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      bindings: bindings.map(binding => ({
        roomId: binding.roomId,
        telegramChatId: binding.telegramChatId,
        telegramChatType: binding.telegramChatType,
        telegramChatTitle: binding.telegramChatTitle,
        createdAt: binding.createdAt,
        messageCount: binding.messageCount,
        lastMessageAt: binding.lastMessageAt,
        createdBy: binding.createdBy
      }))
    });
  } catch (error) {
    console.error('Error getting Telegram bindings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Telegram bindings',
      message: error.message
    });
  }
});

// Relay endpoint for receiving messages from federation registry
router.post("/relay", async (req, res) => {
  try {
    // Initialize services if not already done
    await initializeServices();

    const { roomId, message } = req.body;

    if (!roomId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Room ID and message are required'
      });
    }

    console.log(`📨 Received relay message for room ${roomId} from ${message.from?.platform}`);

    const results = [];

    // Relay to Discord if not from Discord
    if (message.from?.platform !== 'discord') {
      try {
        await sendDiscordMessage(roomId, message);
        results.push({ platform: 'discord', success: true });
      } catch (error) {
        results.push({ platform: 'discord', success: false, error: error.message });
      }
    }

    // Relay to Telegram if not from Telegram
    if (message.from?.platform !== 'telegram') {
      try {
        await sendTelegramMessage(roomId, message);
        results.push({ platform: 'telegram', success: true });
      } catch (error) {
        results.push({ platform: 'telegram', success: false, error: error.message });
      }
    }

    // Relay to Sociality users via Socket.IO if not from Sociality
    if (message.from?.platform !== 'sociality') {
      try {
        const io = req.app.get('io');
        if (io) {
          const socketMessage = {
            id: Date.now().toString(),
            text: message.text,
            sender: {
              _id: message.from?.userId || 'unknown',
              username: message.from?.displayName || 'Unknown User',
              platform: message.from?.platform || 'unknown'
            },
            timestamp: message.sentAt || new Date().toISOString(),
            roomId,
            isCrossPlatform: true,
            platform: message.from?.platform || 'unknown'
          };

          io.to(`room_${roomId}`).emit('crossPlatformMessage', socketMessage);
          results.push({ platform: 'sociality', success: true });
        } else {
          results.push({ platform: 'sociality', success: false, error: 'Socket.IO not available' });
        }
      } catch (error) {
        results.push({ platform: 'sociality', success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      message: 'Message relayed',
      results
    });
  } catch (error) {
    console.error('Error in relay endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to relay message',
      message: error.message
    });
  }
});

// Relay message endpoint (federation registry functionality)
router.post("/relay-message", async (req, res) => {
  try {
    // Initialize services if not already done
    await initializeServices();

    const { roomId, message, originatingPlatform } = req.body;

    if (!roomId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Room ID and message are required'
      });
    }

    console.log(`📡 Federation relay for room ${roomId} from ${originatingPlatform}`);

    // Use serverless federation registry to relay message
    const results = await federationRegistry.relayMessage(roomId, message, originatingPlatform);

    res.json({
      success: true,
      message: 'Message relayed via federation',
      results
    });
  } catch (error) {
    console.error('Error in federation relay:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to relay message via federation',
      message: error.message
    });
  }
});

// Cross-platform services status endpoint
router.get("/status", async (req, res) => {
  try {
    // Initialize services if not already done
    await initializeServices();

    const discordStatus = getDiscordStatus();
    const telegramStatus = getTelegramStatus();
    const federationStats = federationRegistry.getStats();

    res.json({
      success: true,
      services: {
        discord: discordStatus,
        telegram: telegramStatus,
        federation: {
          initialized: true,
          stats: federationStats
        }
      },
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting cross-platform status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status',
      message: error.message
    });
  }
});

// Initialize federation registration
registerWithFederation();

export default router;
