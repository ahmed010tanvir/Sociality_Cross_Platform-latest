const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Room = require('../models/Room');
const Message = require('../models/Message');
const DiscordBinding = require('../models/DiscordBinding');
const { announceRoom, getRoomPeers, getMessagesFromPeer } = require('../utils/federation');

// Get all rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find();
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new room
router.post('/', async (req, res) => {
  try {
    const { name, userId, discordChannelId, discordUsername } = req.body;

    if (!name || !userId) {
      return res.status(400).json({ error: 'Name and userId are required' });
    }

    // Generate a unique roomId
    const roomId = uuidv4();

    // Create room in local database
    const room = new Room({
      roomId,
      name,
      participants: [{ userId }]
    });

    await room.save();

    // Announce room to federation registry
    await announceRoom(roomId, name);

    // Create Discord binding if discordChannelId is provided
    if (discordChannelId && discordUsername) {
      const binding = new DiscordBinding({
        discordChannelId: discordChannelId.toString(),
        platformRoomId: roomId,
        createdBy: {
          userId,
          username: discordUsername
        }
      });

      await binding.save();
      console.log(`Created Discord binding for room ${roomId} and channel ${discordChannelId}`);
    }

    res.status(201).json({
      message: 'Room created successfully',
      room,
      roomId
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get room details
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Get federation peers
    const peers = await getRoomPeers(roomId);

    res.json({
      room,
      peers
    });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join a room
router.post('/:roomId/join', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    // Find room in local database
    let room = await Room.findOne({ roomId });

    // If room doesn't exist locally, create it
    if (!room) {
      room = new Room({
        roomId,
        name: `Room ${roomId}`, // Default name
        participants: []
      });

      // Announce room to federation registry
      await announceRoom(roomId, room.name);
    }

    // Check if user is already a participant
    const isParticipant = room.participants.some(p => p.userId === userId);

    if (!isParticipant) {
      room.participants.push({ userId, joinedAt: new Date() });
      await room.save();
    }

    res.json({
      message: 'Successfully joined room',
      room
    });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Leave a room
router.post('/:roomId/leave', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Remove user from participants
    room.participants = room.participants.filter(p => p.userId !== userId);
    await room.save();

    res.json({
      message: 'Successfully left room',
      room
    });
  } catch (error) {
    console.error('Error leaving room:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a room
router.get('/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, since } = req.query;

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

// Send a message to a room
router.post('/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { text, userId, displayName, platform = 'discord' } = req.body;

    if (!text || !userId) {
      return res.status(400).json({ error: 'Text and userId are required' });
    }

    // Create message
    const message = new Message({
      roomId,
      from: {
        userId,
        displayName: displayName || userId,
        platform
      },
      text,
      sentAt: new Date()
    });

    await message.save();

    // Update room last activity
    await Room.updateOne({ roomId }, { lastActivity: new Date() });

    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
