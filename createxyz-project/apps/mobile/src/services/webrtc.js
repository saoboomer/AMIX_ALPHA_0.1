import { AmiXCrypto } from '../utils/crypto';
import { AmiXStorage } from '../utils/storage';

// AmiX WebRTC Service - P2P messaging implementation
// Uses WebRTC data channels for direct peer-to-peer communication

export class AmiXWebRTC {
  static connections = new Map();
  static dataChannels = new Map();
  static stunServers = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
  ];
  
  static turnServers = [
    // Add your TURN servers here for NAT traversal
    // 'turn:your-turn-server.com:3478',
  ];

  static async initialize() {
    try {
      // Check if WebRTC is supported
      if (typeof RTCPeerConnection === 'undefined') {
        console.warn('WebRTC not supported in this environment');
        return false;
      }

      // Initialize connection state
      this.connections.clear();
      this.dataChannels.clear();

      return true;
    } catch (error) {
      console.error('WebRTC initialization failed:', error);
      return false;
    }
  }

  static async createPeerConnection(peerAmixId) {
    try {
      // Create RTCPeerConnection with STUN/TURN servers
      const configuration = {
        iceServers: [
          { urls: this.stunServers },
          ...this.turnServers.map(url => ({ urls: url })),
        ],
        iceCandidatePoolSize: 10,
      };

      const peerConnection = new RTCPeerConnection(configuration);
      
      // Store connection
      this.connections.set(peerAmixId, {
        connection: peerConnection,
        state: 'new',
        createdAt: Date.now(),
        lastActivity: Date.now(),
      });

      // Set up event handlers
      this.setupConnectionHandlers(peerConnection, peerAmixId);

      return peerConnection;
    } catch (error) {
      console.error('Failed to create peer connection:', error);
      throw error;
    }
  }

  static setupConnectionHandlers(peerConnection, peerAmixId) {
    // Connection state change
    peerConnection.onconnectionstatechange = () => {
      const connection = this.connections.get(peerAmixId);
      if (connection) {
        connection.state = peerConnection.connectionState;
        connection.lastActivity = Date.now();
      }

      console.log(`Connection state for ${peerAmixId}:`, peerConnection.connectionState);

      // Handle connection state changes
      switch (peerConnection.connectionState) {
        case 'connected':
          this.onConnectionEstablished(peerAmixId);
          break;
        case 'disconnected':
        case 'failed':
          this.onConnectionLost(peerAmixId);
          break;
        case 'closed':
          this.cleanupConnection(peerAmixId);
          break;
      }
    };

    // ICE connection state change
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${peerAmixId}:`, peerConnection.iceConnectionState);
    };

    // ICE gathering state change
    peerConnection.onicegatheringstatechange = () => {
      console.log(`ICE gathering state for ${peerAmixId}:`, peerConnection.iceGatheringState);
    };

    // Data channel
    peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, peerAmixId, false);
    };

    // ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate to peer through signaling server
        this.sendIceCandidate(peerAmixId, event.candidate);
      }
    };
  }

  static async createDataChannel(peerAmixId, label = 'amix-messages') {
    try {
      const connection = this.connections.get(peerAmixId);
      if (!connection) {
        throw new Error('No peer connection found');
      }

      const dataChannel = connection.connection.createDataChannel(label, {
        ordered: true,
        maxRetransmits: 3,
      });

      this.setupDataChannel(dataChannel, peerAmixId, true);
      return dataChannel;
    } catch (error) {
      console.error('Failed to create data channel:', error);
      throw error;
    }
  }

  static setupDataChannel(dataChannel, peerAmixId, isInitiator) {
    const channelId = `${peerAmixId}-${dataChannel.label}`;
    
    dataChannel.onopen = () => {
      console.log(`Data channel opened: ${channelId}`);
      this.dataChannels.set(channelId, {
        channel: dataChannel,
        peerAmixId,
        isOpen: true,
        isInitiator,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      });
    };

    dataChannel.onclose = () => {
      console.log(`Data channel closed: ${channelId}`);
      this.dataChannels.delete(channelId);
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error: ${channelId}`, error);
    };

    dataChannel.onmessage = async (event) => {
      try {
        await this.handleIncomingMessage(peerAmixId, event.data);
      } catch (error) {
        console.error('Failed to handle incoming message:', error);
      }
    };
  }

  static async handleIncomingMessage(peerAmixId, data) {
    try {
      // Parse the message
      const message = JSON.parse(data);
      
      // Verify message structure
      if (!message.type || !message.payload) {
        throw new Error('Invalid message format');
      }

      // Update last activity
      const connection = this.connections.get(peerAmixId);
      if (connection) {
        connection.lastActivity = Date.now();
      }

      // Handle different message types
      switch (message.type) {
        case 'encrypted_message':
          await this.handleEncryptedMessage(peerAmixId, message.payload);
          break;
        case 'key_exchange':
          await this.handleKeyExchange(peerAmixId, message.payload);
          break;
        case 'ping':
          await this.sendPong(peerAmixId);
          break;
        case 'pong':
          // Handle pong response
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to handle incoming message:', error);
    }
  }

  static async handleEncryptedMessage(peerAmixId, encryptedData) {
    try {
      // Get ratchet state for this peer
      const ratchetState = await AmiXStorage.getRatchetState(peerAmixId);
      if (!ratchetState) {
        throw new Error('No ratchet state found for peer');
      }

      // Decrypt the message
      const decryptedMessage = await AmiXCrypto.decryptMessage(encryptedData, ratchetState);
      
      // Store the updated ratchet state
      await AmiXStorage.storeRatchetState(peerAmixId, ratchetState);

      // Store the message
      await AmiXStorage.storeMessage(peerAmixId, {
        content: decryptedMessage,
        senderId: peerAmixId,
        timestamp: Date.now(),
        isEncrypted: true,
      });

      // Emit message received event
      this.emit('messageReceived', {
        peerAmixId,
        message: decryptedMessage,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Failed to handle encrypted message:', error);
    }
  }

  static async handleKeyExchange(peerAmixId, keyExchangeData) {
    try {
      // Perform key exchange
      const sharedSecret = await AmiXCrypto.performKeyExchange(
        keyExchangeData.publicKey,
        keyExchangeData.ourPrivateKey
      );

      // Create ratchet state
      const ratchetState = await AmiXCrypto.createRatchetState(
        sharedSecret.sharedSecret,
        keyExchangeData.ourPrivateKey,
        keyExchangeData.publicKey
      );

      // Store ratchet state
      await AmiXStorage.storeRatchetState(peerAmixId, ratchetState);

      console.log('Key exchange completed for peer:', peerAmixId);
    } catch (error) {
      console.error('Failed to handle key exchange:', error);
    }
  }

  static async sendEncryptedMessage(peerAmixId, message) {
    try {
      // Get ratchet state
      const ratchetState = await AmiXStorage.getRatchetState(peerAmixId);
      if (!ratchetState) {
        throw new Error('No ratchet state found for peer');
      }

      // Encrypt the message
      const encryptedData = await AmiXCrypto.encryptMessage(message, ratchetState);
      
      // Store the updated ratchet state
      await AmiXStorage.storeRatchetState(peerAmixId, ratchetState);

      // Send through data channel
      await this.sendMessage(peerAmixId, {
        type: 'encrypted_message',
        payload: encryptedData,
      });

      // Store the message locally
      await AmiXStorage.storeMessage(peerAmixId, {
        content: message,
        senderId: 'self',
        timestamp: Date.now(),
        isEncrypted: true,
      });

      return true;
    } catch (error) {
      console.error('Failed to send encrypted message:', error);
      return false;
    }
  }

  static async sendMessage(peerAmixId, message) {
    try {
      const channelId = `${peerAmixId}-amix-messages`;
      const dataChannel = this.dataChannels.get(channelId);
      
      if (!dataChannel || !dataChannel.isOpen) {
        throw new Error('Data channel not available');
      }

      const messageString = JSON.stringify(message);
      dataChannel.channel.send(messageString);
      
      // Update last activity
      dataChannel.lastActivity = Date.now();
      
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  static async sendPong(peerAmixId) {
    await this.sendMessage(peerAmixId, {
      type: 'pong',
      payload: { timestamp: Date.now() },
    });
  }

  static async sendPing(peerAmixId) {
    await this.sendMessage(peerAmixId, {
      type: 'ping',
      payload: { timestamp: Date.now() },
    });
  }

  // Connection management
  static async connectToPeer(peerAmixId, offerSdp) {
    try {
      // Create peer connection
      const peerConnection = await this.createPeerConnection(peerAmixId);
      
      // Set remote description (offer)
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offerSdp));
      
      // Create answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      return answer;
    } catch (error) {
      console.error('Failed to connect to peer:', error);
      throw error;
    }
  }

  static async acceptConnection(peerAmixId, answerSdp) {
    try {
      const connection = this.connections.get(peerAmixId);
      if (!connection) {
        throw new Error('No peer connection found');
      }

      // Set remote description (answer)
      await connection.connection.setRemoteDescription(new RTCSessionDescription(answerSdp));
      
      return true;
    } catch (error) {
      console.error('Failed to accept connection:', error);
      throw error;
    }
  }

  static async addIceCandidate(peerAmixId, candidate) {
    try {
      const connection = this.connections.get(peerAmixId);
      if (!connection) {
        throw new Error('No peer connection found');
      }

      await connection.connection.addIceCandidate(new RTCIceCandidate(candidate));
      return true;
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
      return false;
    }
  }

  // Event handling
  static eventListeners = new Map();

  static on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  static emit(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
  }

  // Connection state management
  static onConnectionEstablished(peerAmixId) {
    console.log(`Connection established with ${peerAmixId}`);
    this.emit('connectionEstablished', { peerAmixId });
  }

  static onConnectionLost(peerAmixId) {
    console.log(`Connection lost with ${peerAmixId}`);
    this.emit('connectionLost', { peerAmixId });
  }

  static cleanupConnection(peerAmixId) {
    console.log(`Cleaning up connection with ${peerAmixId}`);
    
    // Remove data channels
    for (const [channelId, dataChannel] of this.dataChannels) {
      if (dataChannel.peerAmixId === peerAmixId) {
        this.dataChannels.delete(channelId);
      }
    }
    
    // Remove connection
    this.connections.delete(peerAmixId);
    
    this.emit('connectionClosed', { peerAmixId });
  }

  // Utility functions
  static getConnectionState(peerAmixId) {
    const connection = this.connections.get(peerAmixId);
    return connection ? connection.state : 'disconnected';
  }

  static isConnected(peerAmixId) {
    const connection = this.connections.get(peerAmixId);
    return connection && connection.state === 'connected';
  }

  static getActiveConnections() {
    return Array.from(this.connections.keys()).filter(peerAmixId => 
      this.isConnected(peerAmixId)
    );
  }

  static async cleanup() {
    // Close all connections
    for (const [peerAmixId, connection] of this.connections) {
      try {
        connection.connection.close();
      } catch (error) {
        console.error('Failed to close connection:', error);
      }
    }
    
    // Clear maps
    this.connections.clear();
    this.dataChannels.clear();
    this.eventListeners.clear();
  }

  // Signaling server communication (placeholder)
  static async sendIceCandidate(peerAmixId, candidate) {
    // In production, send through your signaling server
    console.log('ICE candidate for', peerAmixId, candidate);
  }
}
