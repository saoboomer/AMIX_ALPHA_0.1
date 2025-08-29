import * as AmiXCrypto from '../utils/crypto';
import * as PQCrypto from '../utils/pqcrypto';
import MetadataProtection from '../utils/metadataProtection';
import SecurityLogger from '../utils/securityLogger';

class MessageService {
  constructor() {
    this.pendingMessages = new Map();
    this.messageCounter = 0;
  }

  // Prepare a message for sending with all security measures
  async prepareMessage(content, recipientPublicKey, options = {}) {
    try {
      const messageId = await AmiXCrypto.generateSecureUUID();
      const timestamp = Date.now();
      
      // Create message metadata
      const metadata = await MetadataProtection.protect({
        sender: options.senderId,
        timestamp,
        deviceId: await SecurityLogger.getDeviceId(),
        ...options.metadata
      });

      // Encrypt the message content
      const encryptedContent = await AmiXCrypto.encryptMessage(
        content,
        {
          publicKey: recipientPublicKey,
          keyId: options.keyId
        },
        {
          padding: true,
          metadata: options.includeMetadata ? metadata : undefined
        }
      );

      // Prepare the message package
      const message = {
        id: messageId,
        type: 'message',
        content: encryptedContent,
        metadata: options.includeMetadata ? metadata : undefined,
        timestamp,
        keyId: options.keyId,
        version: '1.0'
      };

      // Store pending message for delivery confirmation
      this.storePendingMessage(messageId, {
        ...message,
        status: 'sending',
        timestamp: Date.now()
      });

      // Log message creation
      await SecurityLogger.logEvent(
        SecurityLogger.EVENTS.MESSAGE_CREATED,
        { messageId, recipient: recipientPublicKey }
      );

      return message;
    } catch (error) {
      console.error('Failed to prepare message:', error);
      await SecurityLogger.logEvent(
        SecurityLogger.EVENTS.MESSAGE_ERROR,
        { 
          error: error.message,
          step: 'prepare_message',
          timestamp: Date.now()
        }
      );
      throw error;
    }
  }

  // Process an incoming message
  async processIncomingMessage(encryptedMessage, sessionKeys) {
    try {
      const { id, content, metadata, keyId } = encryptedMessage;
      
      // Check for duplicate messages
      if (this.isDuplicateMessage(id)) {
        await SecurityLogger.logEvent(
          SecurityLogger.EVENTS.DUPLICATE_MESSAGE,
          { messageId: id }
        );
        return null;
      }

      // Decrypt the message
      const decryptedContent = await AmiXCrypto.decryptMessage(
        content,
        sessionKeys,
        { keyId }
      );

      // Process metadata if present
      let processedMetadata = {};
      if (metadata) {
        try {
          processedMetadata = await MetadataProtection.unprotect(metadata);
        } catch (error) {
          console.warn('Failed to process metadata:', error);
          await SecurityLogger.logEvent(
            SecurityLogger.EVENTS.METADATA_ERROR,
            { messageId: id, error: error.message }
          );
        }
      }

      // Update message status
      this.updateMessageStatus(id, 'delivered');

      return {
        ...encryptedMessage,
        decryptedContent,
        metadata: processedMetadata,
        status: 'delivered',
        receivedAt: Date.now()
      };
    } catch (error) {
      console.error('Failed to process message:', error);
      await SecurityLogger.logEvent(
        SecurityLogger.EVENTS.MESSAGE_PROCESSING_ERROR,
        { 
          messageId: encryptedMessage?.id,
          error: error.message,
          timestamp: Date.now()
        }
      );
      throw error;
    }
  }

  // Helper methods
  storePendingMessage(messageId, messageData) {
    this.pendingMessages.set(messageId, {
      ...messageData,
      retryCount: 0,
      lastAttempt: Date.now()
    });
  }

  updateMessageStatus(messageId, status) {
    const message = this.pendingMessages.get(messageId);
    if (message) {
      message.status = status;
      message.updatedAt = Date.now();
      this.pendingMessages.set(messageId, message);
    }
  }

  isDuplicateMessage(messageId) {
    return this.pendingMessages.has(messageId);
  }

  // Clean up old pending messages
  cleanupOldMessages(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    const now = Date.now();
    for (const [id, message] of this.pendingMessages.entries()) {
      if (now - message.timestamp > maxAge) {
        this.pendingMessages.delete(id);
      }
    }
  }
}

export default new MessageService();
