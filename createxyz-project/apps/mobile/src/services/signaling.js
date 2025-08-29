import { AmiXStorage } from '../utils/storage';
import { AmiXCrypto } from '../utils/crypto';
import { EventEmitter } from 'events';

class SignalingService extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.connected = false;
    this.pendingMessages = [];
  }

  async initialize(userId) {
    this.userId = userId;
    
    // In a real app, you would connect to your signaling server here
    // For example:
    // this.socket = new WebSocket('wss://yoursignalingserver.com');
    // this.setupSocketHandlers();
    
    // For now, we'll simulate a connection
    this.connected = true;
    this.processPendingMessages();
    
    console.log('Signaling service initialized for user:', userId);
  }

  async sendSignal(toUserId, signal) {
    const message = {
      type: 'signal',
      from: this.userId,
      to: toUserId,
      data: signal,
      timestamp: Date.now(),
      id: await AmiXCrypto.generateSecureUUID()
    };

    if (this.connected) {
      // In a real app, send via WebSocket
      // this.socket.send(JSON.stringify(message));
      console.log('Sending signal:', message);
      
      // Store the message for reliability
      await this.storeMessage(message);
    } else {
      this.pendingMessages.push(message);
    }
  }

  async sendFriendRequest(toUserId) {
    const message = {
      type: 'friend-request',
      from: this.userId,
      to: toUserId,
      timestamp: Date.now(),
      id: await AmiXCrypto.generateSecureUUID()
    };

    if (this.connected) {
      // In a real app, send via WebSocket
      // this.socket.send(JSON.stringify(message));
      console.log('Sending friend request:', message);
      
      // Store the message for reliability
      await this.storeMessage(message);
    } else {
      this.pendingMessages.push(message);
    }
  }

  async acceptFriendRequest(fromUserId) {
    const message = {
      type: 'friend-request-accepted',
      from: this.userId,
      to: fromUserId,
      timestamp: Date.now(),
      id: await AmiXCrypto.generateSecureUUID()
    };

    if (this.connected) {
      // In a real app, send via WebSocket
      // this.socket.send(JSON.stringify(message));
      console.log('Accepting friend request:', message);
      
      // Store the message for reliability
      await this.storeMessage(message);
    } else {
      this.pendingMessages.push(message);
    }
  }

  async storeMessage(message) {
    try {
      const db = await AmiXStorage.initialize();
      await db.messages.add({
        id: message.id,
        type: 'signaling',
        direction: 'outgoing',
        status: 'sent',
        content: message,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to store signaling message:', error);
    }
  }

  processPendingMessages() {
    if (!this.connected || this.pendingMessages.length === 0) return;
    
    // Process all pending messages
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      this.sendSignal(message.to, message.data);
    }
  }

  // Simulate receiving a message (in a real app, this would come from WebSocket)
  async simulateIncomingMessage(message) {
    console.log('Received message:', message);
    
    // Store the incoming message
    try {
      const db = await AmiXStorage.initialize();
      await db.messages.add({
        id: message.id || await AmiXCrypto.generateSecureUUID(),
        type: 'signaling',
        direction: 'incoming',
        status: 'delivered',
        content: message,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to store incoming message:', error);
    }
    
    // Emit an event for the specific message type
    this.emit(message.type, message);
    // Also emit a generic message event
    this.emit('message', message);
  }

  // Clean up resources
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
    this.removeAllListeners();
  }
}

// Create a singleton instance
export const signalingService = new SignalingService();

export default signalingService;
