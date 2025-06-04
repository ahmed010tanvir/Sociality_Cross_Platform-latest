import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.FEDERATION_PORT || 7300;

// Middleware
app.use(cors());
app.use(express.json());

// Persistent storage for peers and rooms
const dataDir = path.join(__dirname, '../../federation-registry/data');
const peersFile = path.join(dataDir, 'peers.json');
const roomsFile = path.join(dataDir, 'rooms.json');

// Create data directory if it doesn't exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize storage objects
let peers = new Map();
let rooms = new Map();

// Load persisted data
const loadPersistedData = () => {
  try {
    if (fs.existsSync(peersFile)) {
      const peersData = JSON.parse(fs.readFileSync(peersFile, 'utf8'));
      if (Array.isArray(peersData)) {
        peersData.forEach(peer => {
          peers.set(peer.name, peer);
        });
        console.log(`📂 Loaded ${peersData.length} persisted peers`);
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to load persisted peers:', error.message);
  }

  try {
    if (fs.existsSync(roomsFile)) {
      const roomsData = JSON.parse(fs.readFileSync(roomsFile, 'utf8'));
      if (typeof roomsData === 'object') {
        Object.entries(roomsData).forEach(([roomId, roomData]) => {
          rooms.set(roomId, {
            roomId: roomData.roomId,
            name: roomData.name,
            createdAt: new Date(roomData.createdAt || Date.now()),
            peers: new Set(roomData.peers || []),
            messageCount: roomData.messageCount || 0
          });
        });
        console.log(`📂 Loaded ${Object.keys(roomsData).length} persisted rooms`);
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to load persisted rooms:', error.message);
  }
};

// Save data to persistent storage
const persistData = () => {
  try {
    // Save peers
    const peersArray = Array.from(peers.values());
    fs.writeFileSync(peersFile, JSON.stringify(peersArray, null, 2));

    // Save rooms
    const roomsObject = {};
    rooms.forEach((room, roomId) => {
      roomsObject[roomId] = {
        roomId: room.roomId,
        name: room.name,
        createdAt: room.createdAt,
        peers: Array.from(room.peers),
        messageCount: room.messageCount
      };
    });
    fs.writeFileSync(roomsFile, JSON.stringify(roomsObject, null, 2));

    console.log(`💾 Persisted ${peersArray.length} peers and ${Object.keys(roomsObject).length} rooms`);
  } catch (error) {
    console.error('❌ Failed to persist data:', error.message);
  }
};

// Load data on startup
loadPersistedData();

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'federation-registry',
    timestamp: new Date().toISOString(),
    peers: peers.size,
    rooms: rooms.size
  });
});

// Register a peer platform
app.post('/federation/peers', (req, res) => {
  try {
    const { name, url } = req.body;

    if (!name || !url) {
      return res.status(400).json({
        success: false,
        error: 'Name and URL are required'
      });
    }

    const peerData = {
      name,
      url,
      registeredAt: new Date(),
      lastSeen: new Date(),
      status: 'active'
    };

    peers.set(name, peerData);
    persistData(); // Save to disk

    console.log(`✅ Registered peer: ${name} at ${url}`);

    res.json({
      success: true,
      message: `Peer ${name} registered successfully`,
      peer: peerData
    });
  } catch (error) {
    console.error('Error registering peer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register peer',
      message: error.message
    });
  }
});

// Get all registered peers
app.get('/federation/peers', (req, res) => {
  try {
    const peerList = Array.from(peers.values());
    res.json({
      success: true,
      peers: peerList
    });
  } catch (error) {
    console.error('Error fetching peers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch peers',
      message: error.message
    });
  }
});

// Register a room
app.post('/federation/rooms', (req, res) => {
  try {
    const { roomId, name, peerUrl } = req.body;

    if (!roomId || !name || !peerUrl) {
      return res.status(400).json({
        success: false,
        error: 'Room ID, name, and peer URL are required'
      });
    }

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        roomId,
        name,
        createdAt: new Date(),
        peers: new Set(),
        messageCount: 0
      });
    }

    const room = rooms.get(roomId);
    room.peers.add(peerUrl);

    // Ensure all platform peers are included in every room
    const allPlatformUrls = [
      'http://localhost:5000',  // sociality
      'http://localhost:7301',  // telegram
      'http://localhost:7302'   // discord
    ];

    allPlatformUrls.forEach(url => {
      room.peers.add(url);
    });

    persistData(); // Save to disk

    console.log(`✅ Registered room: ${name} (${roomId}) from ${peerUrl}`);

    res.json({
      success: true,
      message: `Room ${name} registered successfully`,
      room: {
        roomId: room.roomId,
        name: room.name,
        peers: Array.from(room.peers),
        messageCount: room.messageCount
      }
    });
  } catch (error) {
    console.error('Error registering room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register room',
      message: error.message
    });
  }
});

// Get all rooms
app.get('/federation/rooms', (req, res) => {
  try {
    const roomList = Array.from(rooms.values()).map(room => ({
      roomId: room.roomId,
      name: room.name,
      createdAt: room.createdAt,
      peers: Array.from(room.peers),
      messageCount: room.messageCount,
      participantCount: room.peers.size
    }));

    res.json(roomList);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rooms',
      message: error.message
    });
  }
});

// Relay message to all peers in a room
app.post('/federation/relay-message', async (req, res) => {
  try {
    const { roomId, message, originatingPlatform } = req.body;

    if (!roomId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Room ID and message are required'
      });
    }

    let room = rooms.get(roomId);
    if (!room) {
      // Auto-create room if it doesn't exist
      console.log(`🏗️ Auto-creating room ${roomId} for message relay`);
      room = {
        roomId,
        name: `Auto-created Room ${roomId}`,
        createdAt: new Date(),
        peers: new Set([
          'http://localhost:5000',  // sociality
          'http://localhost:7301',  // telegram
          'http://localhost:7302'   // discord
        ]),
        messageCount: 0
      };
      rooms.set(roomId, room);
      persistData(); // Save the new room
    }

    // Increment message count and persist
    room.messageCount++;
    persistData();

    // Relay to all peers except the originating platform
    const relayPromises = Array.from(room.peers)
      .filter(peerUrl => peerUrl !== originatingPlatform)
      .map(async (peerUrl) => {
        try {
          console.log(`🚀 Attempting to relay message to ${peerUrl} for room ${roomId}`);
          const response = await axios.post(`${peerUrl}/api/cross-platform/relay`, {
            roomId,
            message: {
              ...message,
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }
          }, {
            timeout: 15000 // Increased timeout from 5000 to 15000ms
          });
          console.log(`✅ Successfully relayed message to ${peerUrl} - Status: ${response.status}`);

          return {
            peer: peerUrl,
            success: true,
            status: response.status
          };
        } catch (error) {
          console.error(`❌ Failed to relay to ${peerUrl}:`, {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
          });
          return {
            peer: peerUrl,
            success: false,
            error: error.message,
            code: error.code,
            status: error.response?.status
          };
        }
      });

    const results = await Promise.allSettled(relayPromises);
    const relayResults = results.map(result =>
      result.status === 'fulfilled' ? result.value : {
        success: false,
        error: result.reason?.message || 'Unknown error'
      }
    );

    console.log(`📨 Relayed message in room ${roomId} to ${relayResults.length} peers`);

    res.json({
      success: true,
      message: 'Message relayed to peers',
      results: relayResults,
      roomMessageCount: room.messageCount
    });
  } catch (error) {
    console.error('Error relaying message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to relay message',
      message: error.message
    });
  }
});

// Remove inactive peers (cleanup endpoint)
app.delete('/federation/peers/:name', (req, res) => {
  try {
    const { name } = req.params;

    if (peers.has(name)) {
      peers.delete(name);
      persistData(); // Save changes to disk
      console.log(`🗑️ Removed peer: ${name}`);

      res.json({
        success: true,
        message: `Peer ${name} removed successfully`
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Peer not found'
      });
    }
  } catch (error) {
    console.error('Error removing peer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove peer',
      message: error.message
    });
  }
});

// Add endpoint to get room peers for debugging
app.get('/federation/rooms/:roomId/peers', (req, res) => {
  try {
    const { roomId } = req.params;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    res.json({
      success: true,
      roomId: room.roomId,
      name: room.name,
      peers: Array.from(room.peers),
      messageCount: room.messageCount
    });
  } catch (error) {
    console.error('Error getting room peers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get room peers',
      message: error.message
    });
  }
});

// Ensure all platforms are registered in all existing rooms
const ensureAllPlatformsInRooms = () => {
  const allPlatformUrls = [
    'http://localhost:5000',  // sociality
    'http://localhost:7301',  // telegram
    'http://localhost:7302'   // discord
  ];

  let roomsUpdated = false;
  rooms.forEach((room, roomId) => {
    allPlatformUrls.forEach(url => {
      if (!room.peers.has(url)) {
        console.log(`🔧 Adding ${url} to existing room ${roomId}`);
        room.peers.add(url);
        roomsUpdated = true;
      }
    });
  });

  if (roomsUpdated) {
    persistData();
    console.log(`✅ Updated ${rooms.size} rooms with all platform peers`);
  }
};

// Start the federation registry server
const startFederationRegistry = () => {
  app.listen(PORT, () => {
    // Only log essential startup info
    console.log(`🌐 Federation Registry running on port ${PORT}`);

    // Ensure all platforms are in all rooms
    ensureAllPlatformsInRooms();
  });
};

// Export for use in main server
export { app as federationApp, startFederationRegistry };
export default app;
