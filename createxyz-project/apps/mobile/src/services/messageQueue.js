import { AmiXStorage } from '../utils/storage';
import { AmiXWebRTC } from './webrtc';
import { AmiXAnalytics } from '../utils/analytics';

// AmiX Message Queue Service - Offline-first messaging implementation
// Implements outbox pattern with retry logic and conflict resolution

export class AmiXMessageQueue {
  static outbox = new Map();
  static retryDelays = [1000, 2000, 5000, 10000, 30000, 60000]; // Exponential backoff
  static maxRetries = 5;
  static isProcessing = false;
  static networkStatus = 'unknown';

  static async initialize() {
    try {
      // Load existing outbox from storage
      await this.loadOutbox();
      
      // Start processing queue
      this.startProcessing();
      
      // Set up network status monitoring
      this.monitorNetworkStatus();
      
      return true;
    } catch (error) {
      console.error('Message queue initialization failed:', error);
      return false;
    }
  }

  static async loadOutbox() {
    try {
      const outboxData = await AmiXStorage.get('message_outbox');
      if (outboxData) {
        this.outbox = new Map(Object.entries(outboxData));
      }
    } catch (error) {
      console.error('Failed to load outbox:', error);
    }
  }

  static async saveOutbox() {
    try {
      const outboxData = Object.fromEntries(this.outbox);
      await AmiXStorage.store('message_outbox', outboxData);
    } catch (error) {
      console.error('Failed to save outbox:', error);
    }
  }

  static async addToOutbox(message) {
    try {
      const messageId = await this.generateMessageId();
      const outboxItem = {
        id: messageId,
        message: message,
        recipientId: message.recipientId,
        timestamp: Date.now(),
        retryCount: 0,
        lastRetry: null,
        status: 'pending',
        priority: message.priority || 'normal',
      };

      this.outbox.set(messageId, outboxItem);
      await this.saveOutbox();

      // Track analytics
      await AmiXAnalytics.trackEvent('message_queued', {
        recipientType: message.recipientType || 'peer',
        priority: outboxItem.priority,
      });

      return messageId;
    } catch (error) {
      console.error('Failed to add message to outbox:', error);
      throw error;
    }
  }

  static async generateMessageId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `${timestamp}-${random}`;
  }

  static async startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    // Process queue every 5 seconds
    setInterval(async () => {
      await this.processQueue();
    }, 5000);
  }

  static async processQueue() {
    if (this.networkStatus !== 'online') {
      return; // Don't process when offline
    }

    try {
      const pendingMessages = Array.from(this.outbox.values())
        .filter(item => item.status === 'pending')
        .sort((a, b) => {
          // Sort by priority first, then by timestamp
          const priorityOrder = { high: 3, normal: 2, low: 1 };
          const aPriority = priorityOrder[a.priority] || 2;
          const bPriority = priorityOrder[b.priority] || 2;
          
          if (aPriority !== bPriority) {
            return bPriority - aPriority;
          }
          
          return a.timestamp - b.timestamp;
        });

      for (const outboxItem of pendingMessages) {
        await this.processMessage(outboxItem);
      }
    } catch (error) {
      console.error('Failed to process message queue:', error);
    }
  }

  static async processMessage(outboxItem) {
    try {
      // Check if message should be retried
      if (outboxItem.retryCount >= this.maxRetries) {
        await this.markMessageFailed(outboxItem.id, 'max_retries_exceeded');
        return;
      }

      // Check retry delay
      if (outboxItem.lastRetry) {
        const delay = this.getRetryDelay(outboxItem.retryCount);
        if (Date.now() - outboxItem.lastRetry < delay) {
          return; // Not time to retry yet
        }
      }

      // Attempt to send message
      const success = await this.sendMessage(outboxItem);
      
      if (success) {
        await this.markMessageSent(outboxItem.id);
      } else {
        await this.markMessageRetry(outboxItem.id);
      }
    } catch (error) {
      console.error('Failed to process message:', error);
      await this.markMessageRetry(outboxItem.id);
    }
  }

  static async sendMessage(outboxItem) {
    try {
      const { message, recipientId } = outboxItem;

      // Try P2P first
      if (AmiXWebRTC.isConnected(recipientId)) {
        const success = await AmiXWebRTC.sendEncryptedMessage(recipientId, message.content);
        if (success) {
          return true;
        }
      }

      // Fallback to relay service
      return await this.sendViaRelay(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  static async sendViaRelay(message) {
    try {
      const response = await fetch('/api/relay/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId: message.recipientId,
          encryptedData: message.encryptedData,
          timestamp: Date.now(),
          ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Relay send failed:', error);
      return false;
    }
  }

  static getRetryDelay(retryCount) {
    const index = Math.min(retryCount, this.retryDelays.length - 1);
    return this.retryDelays[index];
  }

  static async markMessageSent(messageId) {
    try {
      const outboxItem = this.outbox.get(messageId);
      if (outboxItem) {
        outboxItem.status = 'sent';
        outboxItem.sentAt = Date.now();
        this.outbox.set(messageId, outboxItem);
        await this.saveOutbox();

        // Track analytics
        await AmiXAnalytics.trackEvent('message_sent', {
          deliveryMethod: outboxItem.deliveryMethod || 'p2p',
          retryCount: outboxItem.retryCount,
        });
      }
    } catch (error) {
      console.error('Failed to mark message as sent:', error);
    }
  }

  static async markMessageRetry(messageId) {
    try {
      const outboxItem = this.outbox.get(messageId);
      if (outboxItem) {
        outboxItem.retryCount += 1;
        outboxItem.lastRetry = Date.now();
        this.outbox.set(messageId, outboxItem);
        await this.saveOutbox();
      }
    } catch (error) {
      console.error('Failed to mark message for retry:', error);
    }
  }

  static async markMessageFailed(messageId, reason) {
    try {
      const outboxItem = this.outbox.get(messageId);
      if (outboxItem) {
        outboxItem.status = 'failed';
        outboxItem.failureReason = reason;
        outboxItem.failedAt = Date.now();
        this.outbox.set(messageId, outboxItem);
        await this.saveOutbox();

        // Track analytics
        await AmiXAnalytics.trackEvent('message_failed', {
          reason: reason,
          retryCount: outboxItem.retryCount,
        });
      }
    } catch (error) {
      console.error('Failed to mark message as failed:', error);
    }
  }

  static monitorNetworkStatus() {
    // Monitor network status changes
    if (typeof navigator !== 'undefined' && navigator.onLine !== undefined) {
      this.networkStatus = navigator.onLine ? 'online' : 'offline';
      
      window.addEventListener('online', () => {
        this.networkStatus = 'online';
        this.onNetworkOnline();
      });
      
      window.addEventListener('offline', () => {
        this.networkStatus = 'offline';
        this.onNetworkOffline();
      });
    }
  }

  static async onNetworkOnline() {
    console.log('Network came online - processing queue');
    
    // Process queue immediately when network comes online
    setTimeout(async () => {
      await this.processQueue();
    }, 1000);
  }

  static async onNetworkOffline() {
    console.log('Network went offline - pausing queue processing');
  }

  // Message acknowledgment system
  static async sendAcknowledgment(messageId, recipientId) {
    try {
      const ackMessage = {
        type: 'acknowledgment',
        messageId: messageId,
        timestamp: Date.now(),
      };

      if (AmiXWebRTC.isConnected(recipientId)) {
        await AmiXWebRTC.sendMessage(recipientId, ackMessage);
      } else {
        await this.sendViaRelay({
          recipientId: recipientId,
          encryptedData: ackMessage,
        });
      }
    } catch (error) {
      console.error('Failed to send acknowledgment:', error);
    }
  }

  static async handleAcknowledgment(ackMessage) {
    try {
      const { messageId } = ackMessage;
      await this.markMessageSent(messageId);
    } catch (error) {
      console.error('Failed to handle acknowledgment:', error);
    }
  }

  // Conflict resolution for out-of-order messages
  static async resolveMessageConflicts(conversationId) {
    try {
      const messages = await AmiXStorage.getMessages(conversationId);
      
      // Sort messages by timestamp and resolve conflicts
      const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);
      
      // Remove duplicates based on content and timestamp
      const uniqueMessages = [];
      const seen = new Set();
      
      for (const message of sortedMessages) {
        const key = `${message.content}-${message.timestamp}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueMessages.push(message);
        }
      }
      
      // Update storage with resolved messages
      await AmiXStorage.storeMessage(conversationId, uniqueMessages);
      
      return uniqueMessages;
    } catch (error) {
      console.error('Failed to resolve message conflicts:', error);
      return [];
    }
  }

  // Queue management
  static async getOutboxStatus() {
    const pending = Array.from(this.outbox.values()).filter(item => item.status === 'pending').length;
    const sent = Array.from(this.outbox.values()).filter(item => item.status === 'sent').length;
    const failed = Array.from(this.outbox.values()).filter(item => item.status === 'failed').length;
    
    return {
      pending,
      sent,
      failed,
      total: this.outbox.size,
      networkStatus: this.networkStatus,
    };
  }

  static async clearSentMessages() {
    try {
      const sentMessages = Array.from(this.outbox.entries())
        .filter(([_, item]) => item.status === 'sent');
      
      for (const [messageId, _] of sentMessages) {
        this.outbox.delete(messageId);
      }
      
      await this.saveOutbox();
    } catch (error) {
      console.error('Failed to clear sent messages:', error);
    }
  }

  static async retryFailedMessages() {
    try {
      const failedMessages = Array.from(this.outbox.values())
        .filter(item => item.status === 'failed');
      
      for (const outboxItem of failedMessages) {
        outboxItem.status = 'pending';
        outboxItem.retryCount = 0;
        outboxItem.lastRetry = null;
        this.outbox.set(outboxItem.id, outboxItem);
      }
      
      await this.saveOutbox();
    } catch (error) {
      console.error('Failed to retry failed messages:', error);
    }
  }

  static async deleteMessage(messageId) {
    try {
      this.outbox.delete(messageId);
      await this.saveOutbox();
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }

  // Utility functions
  static isOnline() {
    return this.networkStatus === 'online';
  }

  static getQueueSize() {
    return this.outbox.size;
  }

  static async cleanup() {
    try {
      // Clear old sent messages (older than 30 days)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const oldSentMessages = Array.from(this.outbox.entries())
        .filter(([_, item]) => 
          item.status === 'sent' && item.sentAt < thirtyDaysAgo
        );
      
      for (const [messageId, _] of oldSentMessages) {
        this.outbox.delete(messageId);
      }
      
      await this.saveOutbox();
    } catch (error) {
      console.error('Failed to cleanup message queue:', error);
    }
  }
}
