import express from "express";
import axios from "axios";
import Room from "../models/roomModel.js";

const router = express.Router();

// Get all federated rooms
router.get("/rooms", async (req, res) => {
  try {
    const federationRegistryUrl = process.env.FEDERATION_REGISTRY_URL || 'http://localhost:7300';

    // Get rooms from federation registry
    const response = await axios.get(`${federationRegistryUrl}/federation/rooms`);
    const federatedRooms = response.data;

    // Also get local rooms that have federation enabled
    const localRooms = await Room.find({ 'federationSettings.isEnabled': true });

    // Combine and deduplicate rooms
    const allRooms = [...federatedRooms];

    // Add local rooms that aren't already in the federation registry
    localRooms.forEach(localRoom => {
      const exists = federatedRooms.some(fedRoom => fedRoom.roomId === localRoom._id.toString());
      if (!exists) {
        allRooms.push({
          roomId: localRoom._id.toString(),
          name: localRoom.name,
          peers: localRoom.federationSettings.registeredPeers || []
        });
      }
    });

    res.json({
      success: true,
      rooms: allRooms
    });
  } catch (error) {
    console.error('Error fetching federated rooms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch federated rooms',
      message: error.message
    });
  }
});

// Create a new federated room
router.post("/rooms", async (req, res) => {
  try {
    const { name, allowedPlatforms = ['sociality', 'telegram', 'discord'] } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Room name is required'
      });
    }

    // Create room in local database
    const room = new Room({
      name,
      participants: [],
      federationSettings: {
        isEnabled: true,
        allowedPlatforms,
        registeredPeers: [],
        lastSyncAt: new Date()
      }
    });

    await room.save();

    // Register room with federation registry
    const federationRegistryUrl = process.env.FEDERATION_REGISTRY_URL || 'http://localhost:7300';
    const platformUrl = process.env.PLATFORM_URL || 'http://localhost:5000';

    try {
      await axios.post(`${federationRegistryUrl}/federation/rooms`, {
        roomId: room._id.toString(),
        name: room.name,
        peerUrl: platformUrl
      });
    } catch (federationError) {
      console.warn('Failed to register room with federation registry:', federationError.message);
      // Continue even if federation registration fails
    }

    res.status(201).json({
      success: true,
      room: {
        roomId: room._id.toString(),
        name: room.name,
        federationSettings: room.federationSettings
      }
    });
  } catch (error) {
    console.error('Error creating federated room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create federated room',
      message: error.message
    });
  }
});

// Join a federated room
router.post("/rooms/:roomId/join", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, username } = req.body;

    if (!userId || !username) {
      return res.status(400).json({
        success: false,
        error: 'User ID and username are required'
      });
    }

    // Find or create the room locally
    let room = await Room.findById(roomId);

    if (!room) {
      // Create a local copy of the federated room
      room = new Room({
        _id: roomId,
        name: `Federated Room ${roomId}`,
        participants: [],
        federationSettings: {
          isEnabled: true,
          allowedPlatforms: ['sociality', 'telegram', 'discord'],
          registeredPeers: [],
          lastSyncAt: new Date()
        }
      });
    }

    // Add user to room if not already present
    const existingParticipant = room.participants.find(p => p.toString() === userId);
    if (!existingParticipant) {
      room.participants.push(userId);
      await room.save();
    }

    res.json({
      success: true,
      message: 'Successfully joined federated room',
      room: {
        roomId: room._id.toString(),
        name: room.name,
        participantCount: room.participants.length
      }
    });
  } catch (error) {
    console.error('Error joining federated room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join federated room',
      message: error.message
    });
  }
});

// Send message to federated room
router.post("/rooms/:roomId/messages", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { message, userId, username } = req.body;

    if (!message || !userId || !username) {
      return res.status(400).json({
        success: false,
        error: 'Message, user ID, and username are required'
      });
    }

    // Prepare message for federation
    const federatedMessage = {
      id: Date.now().toString(),
      text: message,
      from: {
        id: userId,
        username: username,
        platform: 'sociality'
      },
      timestamp: new Date().toISOString(),
      roomId
    };

    // Send to federation registry for relay
    const federationRegistryUrl = process.env.FEDERATION_REGISTRY_URL || 'http://localhost:7300';
    const platformUrl = process.env.PLATFORM_URL || 'http://localhost:5000';

    try {
      const relayResponse = await axios.post(`${federationRegistryUrl}/federation/relay-message`, {
        roomId,
        message: federatedMessage,
        originatingPlatform: platformUrl
      });

      res.json({
        success: true,
        message: 'Message sent to federated room',
        relayResults: relayResponse.data.results
      });
    } catch (relayError) {
      console.error('Failed to relay message:', relayError.message);
      res.status(500).json({
        success: false,
        error: 'Failed to relay message to other platforms',
        message: relayError.message
      });
    }
  } catch (error) {
    console.error('Error sending federated message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send federated message',
      message: error.message
    });
  }
});

// Receive relayed messages from other platforms
router.post("/relay", async (req, res) => {
  try {
    const { roomId, message } = req.body;

    if (!roomId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Room ID and message are required'
      });
    }

    console.log(`Received relayed message for room ${roomId} from ${message.from?.platform || 'unknown platform'}`);

    // Find the room
    let room = await Room.findById(roomId);

    if (!room) {
      // Create a local copy of the federated room if it doesn't exist
      room = new Room({
        _id: roomId,
        name: `Federated Room ${roomId}`,
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

    // Emit the message to connected Sociality users via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`room_${roomId}`).emit('federatedMessage', {
        id: message.id || Date.now().toString(),
        text: message.text,
        sender: {
          _id: message.from?.id || 'unknown',
          username: message.from?.username || 'Unknown User',
          platform: message.from?.platform || 'unknown'
        },
        timestamp: message.timestamp || new Date().toISOString(),
        roomId,
        isFederated: true,
        platform: message.from?.platform || 'unknown'
      });
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

// Health check endpoint for federation
router.get("/health", (req, res) => {
  res.json({
    status: 'ok',
    platform: 'sociality',
    timestamp: new Date().toISOString(),
    federationEnabled: process.env.FEDERATION_ENABLED === 'true'
  });
});

export default router;
