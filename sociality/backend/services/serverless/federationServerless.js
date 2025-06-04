import axios from 'axios';

// In-memory storage for serverless environment
// In production, this would be replaced with Redis or database storage
const peers = new Map();
const rooms = new Map();

// Federation registry implementation for serverless
export const federationRegistry = {
  // Register a peer platform
  registerPeer: (name, url) => {
    const peerData = {
      name,
      url,
      registeredAt: new Date(),
      lastSeen: new Date(),
      status: 'active'
    };

    peers.set(name, peerData);
    console.log(`✅ Registered peer: ${name} at ${url}`);
    return peerData;
  },

  // Get all registered peers
  getPeers: () => {
    return Array.from(peers.values());
  },

  // Register a room
  registerRoom: (roomId, name, peerUrl) => {
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

    console.log(`✅ Registered room: ${roomId} with peer: ${peerUrl}`);
    return room;
  },

  // Get room information
  getRoom: (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      return {
        ...room,
        peers: Array.from(room.peers)
      };
    }
    return null;
  },

  // Get all rooms
  getRooms: () => {
    return Array.from(rooms.values()).map(room => ({
      ...room,
      peers: Array.from(room.peers)
    }));
  },

  // Relay message to all peers in a room
  relayMessage: async (roomId, message, originatingPlatform) => {
    const room = rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const results = [];
    const targetPeers = Array.from(room.peers).filter(peer => peer !== originatingPlatform);

    console.log(`📡 Relaying message to ${targetPeers.length} peers for room ${roomId}`);

    for (const peerUrl of targetPeers) {
      try {
        // Determine the relay endpoint based on platform
        let relayEndpoint;
        if (peerUrl.includes('sociality') || peerUrl.includes('vercel.app')) {
          relayEndpoint = `${peerUrl}/api/cross-platform/relay`;
        } else if (peerUrl.includes('7301')) {
          relayEndpoint = `${peerUrl}/api/cross-platform/relay`;
        } else if (peerUrl.includes('7302')) {
          relayEndpoint = `${peerUrl}/api/cross-platform/relay`;
        } else {
          relayEndpoint = `${peerUrl}/api/cross-platform/relay`;
        }

        const response = await axios.post(relayEndpoint, {
          roomId,
          message
        }, {
          timeout: 5000 // 5 second timeout for serverless
        });

        results.push({
          peer: peerUrl,
          success: true,
          response: response.data
        });

        console.log(`✅ Message relayed to ${peerUrl}`);
      } catch (error) {
        results.push({
          peer: peerUrl,
          success: false,
          error: error.message
        });

        console.warn(`⚠️ Failed to relay message to ${peerUrl}: ${error.message}`);
      }
    }

    // Update room message count
    room.messageCount = (room.messageCount || 0) + 1;

    return results;
  },

  // Remove a room
  removeRoom: (roomId) => {
    const removed = rooms.delete(roomId);
    if (removed) {
      console.log(`🗑️ Removed room: ${roomId}`);
    }
    return removed;
  },

  // Update peer status
  updatePeerStatus: (name, status) => {
    const peer = peers.get(name);
    if (peer) {
      peer.status = status;
      peer.lastSeen = new Date();
      return peer;
    }
    return null;
  },

  // Get statistics
  getStats: () => {
    return {
      totalPeers: peers.size,
      activePeers: Array.from(peers.values()).filter(p => p.status === 'active').length,
      totalRooms: rooms.size,
      totalMessages: Array.from(rooms.values()).reduce((sum, room) => sum + (room.messageCount || 0), 0)
    };
  }
};

// Initialize default peers for serverless environment
export const initializeFederationRegistry = () => {
  // Register default peers
  const defaultPeers = [
    { name: 'sociality', url: 'https://sociality-black.vercel.app' },
    { name: 'telegram', url: 'https://sociality-black.vercel.app' },
    { name: 'discord', url: 'https://sociality-black.vercel.app' }
  ];

  defaultPeers.forEach(peer => {
    federationRegistry.registerPeer(peer.name, peer.url);
  });

  console.log('🌐 Federation registry initialized for serverless');
  return federationRegistry;
};

// Helper function to ensure room exists with all platforms
export const ensureRoomWithAllPlatforms = (roomId, roomName = null) => {
  const room = federationRegistry.registerRoom(roomId, roomName || `Room ${roomId}`, 'https://sociality-black.vercel.app');
  
  // Ensure all platforms are registered for this room
  const platforms = [
    'https://sociality-black.vercel.app',
    'https://sociality-black.vercel.app', // Telegram endpoint
    'https://sociality-black.vercel.app'  // Discord endpoint
  ];

  platforms.forEach(platform => {
    room.peers.add(platform);
  });

  return room;
};

// Export for use in routes
export default federationRegistry;
