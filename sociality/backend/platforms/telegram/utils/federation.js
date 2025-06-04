const axios = require('axios');

const REGISTRY_URL = process.env.REGISTRY_URL || 'http://localhost:7300';
const PLATFORM_URL = process.env.PLATFORM_URL || 'http://localhost:7301';
const PLATFORM_NAME = process.env.PLATFORM_NAME || 'telegram';

// Register this platform with the federation registry
async function registerPlatform() {
  try {
    const response = await axios.post(`${REGISTRY_URL}/federation/peers`, {
      name: PLATFORM_NAME,
      url: PLATFORM_URL
    });
    console.log('Platform registered with federation registry:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to register platform:', error.message);
    throw error;
  }
}

// Announce a room to the federation registry
async function announceRoom(roomId, roomName) {
  try {
    const response = await axios.post(`${REGISTRY_URL}/federation/rooms`, {
      roomId,
      name: roomName,
      peerUrl: PLATFORM_URL
    });
    console.log(`Room ${roomId} announced to federation registry`);
    return response.data;
  } catch (error) {
    console.error(`Failed to announce room ${roomId}:`, error.message);
    throw error;
  }
}

// Get peers for a room from the federation registry
async function getRoomPeers(roomId) {
  try {
    const response = await axios.get(`${REGISTRY_URL}/federation/rooms/${roomId}/peers`);
    return response.data;
  } catch (error) {
    console.error(`Failed to get peers for room ${roomId}:`, error.message);
    throw error;
  }
}

// Get messages from a peer platform
async function getMessagesFromPeer(peerUrl, roomId, since) {
  try {
    const response = await axios.get(`${peerUrl}/api/messages/${roomId}`, {
      params: { since }
    });
    return response.data;
  } catch (error) {
    console.error(`Failed to get messages from peer ${peerUrl}:`, error.message);
    throw error;
  }
}

// Relay a message to the federation registry
async function relayMessageToFederation(roomId, message) {
  try {
    const response = await axios.post(`${REGISTRY_URL}/federation/relay-message`, {
      roomId,
      message,
      originatingPlatform: PLATFORM_URL
    });
    console.log(`Message relayed to federation for room ${roomId}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to relay message to federation:`, error.message);
    throw error;
  }
}

module.exports = {
  registerPlatform,
  announceRoom,
  getRoomPeers,
  getMessagesFromPeer,
  relayMessageToFederation
};
