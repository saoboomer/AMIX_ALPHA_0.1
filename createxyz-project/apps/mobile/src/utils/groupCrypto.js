import { AmiXCrypto } from './crypto';
import { AmiXStorage } from './storage';

// GroupCrypto handles cryptographic operations for group messaging
export class GroupCrypto {
  // Group message types
  static MESSAGE_TYPES = {
    REGULAR: 'regular',
    REACTION: 'reaction',
    KEY_ROTATION: 'key_rotation',
    MEMBER_ADD: 'member_add',
    MEMBER_REMOVE: 'member_remove',
    GROUP_UPDATE: 'group_update',
    RATCHET_UPDATE: 'ratchet_update',
    GROUP_SYNC: 'group_sync'
  };

  // Key rotation intervals (in milliseconds)
  static ROTATION_INTERVALS = {
    SHORT: 24 * 60 * 60 * 1000,    // 1 day
    MEDIUM: 7 * 24 * 60 * 60 * 1000, // 1 week
    LONG: 30 * 24 * 60 * 60 * 1000  // 1 month
  };

  /**
   * Initialize a new group with the creator and initial members
   * @param {string} groupId - Unique group ID
   * @param {Object} creator - Creator's user info
   * @param {Array} members - Initial group members (excluding creator)
   * @param {Object} [options] - Group creation options
   * @param {number} [options.keyRotationInterval] - Key rotation interval in ms
   * @returns {Promise<Object>} - Initial group state
   */
  static async createGroup(groupId, creator, members = [], options = {}) {
    try {
      const now = Date.now();
      const allMembers = [creator, ...members];

      // Generate signing key pair for the group
      const signingKeyPair = await AmiXCrypto.generateSigningKeyPair();

      // Generate encryption key pair for the group
      const encryptionKeyPair = await AmiXCrypto.generateIdentityKeys();

      // Create group state
      const groupState = {
        groupId,
        members: {},
        signingKeyPair,
        encryptionKeyPair,
        keyRotationInterval: options.keyRotationInterval || this.ROTATION_INTERVALS.MEDIUM,
        nextKeyRotation: now + (options.keyRotationInterval || this.ROTATION_INTERVALS.MEDIUM),
        createdAt: now,
        updatedAt: now,
        lastKeyRotation: now,
        version: '1.0.0',
        metadata: {
          name: `Group-${groupId.substring(0, 8)}`,
          createdAt: new Date().toISOString(),
          createdBy: creator.id
        }
      };

      // Add creator as admin
      await this._addMember(groupState, creator, true);

      // Add initial members
      for (const member of members) {
        await this._addMember(groupState, member, false);
      }

      // Initialize ratchet states for all member pairs
      await this._initializeMemberRatchetStates(groupState, allMembers);

      // Schedule key rotation
      this._scheduleKeyRotation(groupState);

      // Store group state
      await AmiXStorage.storeGroup(groupState);

      return groupState;
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error;
    }
  }

  /**
   * Encrypt a message for the group with forward secrecy
   * @param {string} groupId - ID of the group
   * @param {Object} sender - Sender's user info
   * @param {string|Object} message - Message to encrypt (string or object)
   * @param {Object} [options] - Encryption options
   * @param {Object} [options.metadata] - Additional metadata to include
   * @param {boolean} [options.urgent=false] - Whether to mark as urgent
   * @returns {Promise<Object>} - Encrypted message and headers
   */
  static async encryptGroupMessage(groupId, sender, message, options = {}) {
    try {
      const groupState = await AmiXStorage.getGroup(groupId);
      if (!groupState) {
        throw new Error('Group not found');
      }

      const messageId = await AmiXCrypto.generateSecureUUID();
      const timestamp = Date.now();
      const encryptedMessages = [];
      const messageString = typeof message === 'string' ? message : JSON.stringify(message);

      // Prepare additional authenticated data (AAD)
      const aad = {
        groupId,
        messageId,
        senderId: sender.id,
        timestamp,
        type: this.MESSAGE_TYPES.REGULAR,
        ...(options.metadata || {})
      };

      // Encrypt for each member
      const memberIds = Object.keys(groupState.members);

      await Promise.all(memberIds.map(async (memberId) => {
        if (memberId === sender.id) return; // Skip sender

        try {
          // Get ratchet state for this member pair
          const ratchetState = await this._getRatchetState(groupId, sender.id, memberId);

          // Encrypt the message with AAD
          const encrypted = await AmiXCrypto.encryptMessage(
            messageString,
            ratchetState,
            { 
              aad: new TextEncoder().encode(JSON.stringify(aad)),
              urgent: options.urgent
            }
          );

          // Add to encrypted messages
          encryptedMessages.push({
            recipientId: memberId,
            ...encrypted
          });

          // Update ratchet state in storage
          await AmiXStorage.updateRatchetState(
            groupId, 
            sender.id, 
            memberId, 
            ratchetState
          );

        } catch (error) {
          console.error(`Failed to encrypt for member ${memberId}:`, error);
          // Continue with other members even if one fails
        }
      }));

      // Sign the message
      const signature = await AmiXCrypto.signMessage(
        JSON.stringify({
          ...aad,
          messageHash: await AmiXCrypto.hash(messageString)
        }),
        groupState.signingKeyPair.privateKey
      );

      // Update group state
      groupState.updatedAt = timestamp;
      await AmiXStorage.storeGroup(groupState);

      return {
        ...aad,
        encryptedMessages,
        signature,
        version: '1.1.0',
        metadata: {
          ...(options.metadata || {}),
          encrypted: true,
          urgent: !!options.urgent,
          memberCount: memberIds.length - 1 // Exclude sender
        }
      };
    } catch (error) {
      console.error('Failed to encrypt group message:', error);
      throw error;
    }
  }

  /**
   * Decrypt a group message with forward secrecy
   * @param {string} groupId - ID of the group
   * @param {Object} message - Encrypted message
   * @param {string} recipientId - ID of the recipient
   * @param {Object} [options] - Decryption options
   * @returns {Promise<Object>} - Decrypted message and metadata
   */
  static async decryptGroupMessage(groupId, message, recipientId, options = {}) {
    try {
      const groupState = await AmiXStorage.getGroup(groupId);
      if (!groupState) {
        throw new Error('Group not found');
      }

      // Find the message for this recipient
      const encryptedMessage = message.encryptedMessages.find(
        msg => msg.recipientId === recipientId
      );

      if (!encryptedMessage) {
        throw new Error('No message found for this recipient');
      }

      // Get ratchet state for this sender-recipient pair
      const ratchetState = await this._getRatchetState(
        groupId,
        message.senderId || message.sender, // Handle both formats
        recipientId,
        { createIfMissing: false }
      );

      if (!ratchetState) {
        throw new Error('No active session with sender');
      }

      // Prepare additional authenticated data (AAD)
      const aad = {
        groupId,
        messageId: message.messageId,
        senderId: message.senderId || message.sender,
        timestamp: message.timestamp,
        type: message.type,
        ...(message.metadata || {})
      };

      // Decrypt the message with AAD verification
      const decrypted = await AmiXCrypto.decryptMessage(
        {
          ...encryptedMessage,
          messageCount: message.messageCount
        },
        ratchetState,
        { 
          aad: new TextEncoder().encode(JSON.stringify(aad)),
          skipAadVerification: options.skipAadVerification
        }
      );

      // Update ratchet state in storage
      await AmiXStorage.updateRatchetState(
        groupId,
        message.senderId || message.sender,
        recipientId,
        ratchetState
      );

      // Verify the signature if not already verified by AAD
      if (!options.skipSignatureVerification) {
        const isValid = await AmiXCrypto.verifyMessageIntegrity(
          JSON.stringify({
            ...aad,
            messageHash: await AmiXCrypto.hash(decrypted)
          }),
          message.signature,
          groupState.signingKeyPair.publicKey
        );

        if (!isValid) {
          throw new Error('Invalid message signature');
        }
      }

      // Parse the message if it's a JSON string
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(decrypted);
      } catch (e) {
        parsedMessage = decrypted; // Return as string if not JSON
      }

      return {
        ...aad,
        content: parsedMessage,
        metadata: {
          ...(message.metadata || {}),
          decrypted: true,
          verified: true
        }
      };
    } catch (error) {
      console.error('Failed to decrypt group message:', error);

      // Handle specific error cases
      if (error.message.includes('ratchet state not found')) {
        // Trigger ratchet state recovery
        await this._recoverRatchetState(groupId, message.senderId || message.sender, recipientId);
        // Retry decryption once
        return this.decryptGroupMessage(groupId, message, recipientId, {
          ...options,
          isRetry: true
        });
      }

      throw error;
    }
  }

  // --- Helper Methods ---

  /**
   * Get ratchet state for a member pair with recovery options
   * @private
   */
  static async _getRatchetState(groupId, senderId, recipientId, options = {}) {
    try {
      // Try to get existing ratchet state
      let ratchetState = await AmiXStorage.getRatchetState(groupId, senderId, recipientId);

      // Create new ratchet state if it doesn't exist and createIfMissing is true
      if (!ratchetState && options.createIfMissing !== false) {
        const groupState = await AmiXStorage.getGroup(groupId);
        if (!groupState) {
          throw new Error('Group not found');
        }

        // Generate new ratchet state
        const { sharedSecret } = await AmiXCrypto.performKeyExchange(
          groupState.members[senderId].publicKey,
          groupState.members[recipientId].privateKey
        );

        ratchetState = await AmiXCrypto.createRatchetState(
          sharedSecret,
          groupState.members[recipientId].privateKey,
          groupState.members[senderId].publicKey
        );

        // Store the new ratchet state
        await AmiXStorage.storeRatchetState(
          groupId,
          senderId,
          recipientId,
          ratchetState
        );
      }

      return ratchetState;
    } catch (error) {
      console.error('Error getting ratchet state:', error);
      if (options.throwOnError !== false) {
        throw new Error(`Failed to get ratchet state: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Recover from a lost or out-of-sync ratchet state
   * @private
   */
  static async _recoverRatchetState(groupId, senderId, recipientId) {
    console.warn(`Attempting to recover ratchet state for ${senderId}-${recipientId}`);

    // In a real implementation, this would involve:
    // 1. Requesting a new key exchange from the sender
    // 2. Verifying the sender's identity
    // 3. Establishing a new ratchet state

    // For now, we'll just create a new ratchet state
    const groupState = await AmiXStorage.getGroup(groupId);
    if (!groupState) {
      throw new Error('Group not found');
    }

    // Generate new ratchet state
    const { sharedSecret } = await AmiXCrypto.performKeyExchange(
      groupState.members[senderId].publicKey,
      groupState.members[recipientId].privateKey
    );

    const ratchetState = await AmiXCrypto.createRatchetState(
      sharedSecret,
      groupState.members[recipientId].privateKey,
      groupState.members[senderId].publicKey
    );

    // Store the new ratchet state
    await AmiXStorage.storeRatchetState(
      groupId,
      senderId,
      recipientId,
      ratchetState
    );

    return ratchetState;
  }

  /**
   * Schedule the next key rotation for a group
   * @private
   */
  static _scheduleKeyRotation(groupState) {
    if (groupState.rotationTimer) {
      clearTimeout(groupState.rotationTimer);
    }

    const timeUntilRotation = groupState.nextKeyRotation - Date.now();
    
    // Schedule the next rotation
    groupState.rotationTimer = setTimeout(
      () => this._rotateGroupKeys(groupState.groupId),
      Math.max(0, timeUntilRotation)
    );
  }

  static async _rotateGroupKeys(groupId) {
    try {
      const groupState = await AmiXStorage.getGroup(groupId);
      if (!groupState) return;

      // Generate new encryption key pair
      const newKeyPair = await AmiXCrypto.generateIdentityKeys();
      
      // Update group state
      groupState.encryptionKeyPair = newKeyPair;
      groupState.lastKeyRotation = Date.now();
      groupState.nextKeyRotation = Date.now() + groupState.keyRotationInterval;
      groupState.version = this._incrementVersion(groupState.version);
      
      // Store updated state
      await AmiXStorage.storeGroup(groupState);
      
      // Notify group members of key rotation
      await this._broadcastKeyRotation(groupId, newKeyPair.publicKey);
      
      // Schedule next rotation
      this._scheduleKeyRotation(groupState);
      
      return newKeyPair;
    } catch (error) {
      console.error('Failed to rotate group keys:', error);
      throw error;
    }
  }
  
  /**
   * Helper to increment version string (e.g., '1.0.0' -> '1.0.1')
   * @private
   */
  static _incrementVersion(version) {
    const parts = version.split('.').map(Number);
    parts[parts.length - 1]++;
    return parts.join('.');
  }

  /**
   * Remove a member from the group
   * @param {string} groupId - Group ID
   * @param {Object} remover - User removing the member
   * @param {string} memberIdToRemove - ID of member to remove
   * @returns {Promise<Object>} - Updated group state
   */
  static async removeMember(groupId, remover, memberIdToRemove) {
    try {
      const groupState = await AmiXStorage.getGroup(groupId);
      if (!groupState) {
        throw new Error('Group not found');
      }

      // Verify remover is an admin
      if (!groupState.members[remover.id]?.isAdmin) {
        throw new Error('Only admins can remove members');
      }

      // Verify member exists
      if (!groupState.members[memberIdToRemove]) {
        throw new Error('Member not found in group');
      }

      // Remove member
      delete groupState.members[memberIdToRemove];
      
      // Update group version and timestamp
      groupState.version = this._incrementVersion(groupState.version);
      groupState.updatedAt = Date.now();
      
      // Schedule key rotation
      await this._scheduleKeyRotation(groupState);
      
      // Store updated state
      await AmiXStorage.storeGroup(groupState);
      
      return groupState;
    } catch (error) {
      console.error('Failed to remove member:', error);
      throw error;
    }
  }

  /**
   * Get the current group state
   * @param {string} groupId - Group ID
   * @returns {Promise<Object>} - Group state
   */
  static async getGroupState(groupId) {
    try {
      const groupState = await AmiXStorage.getGroup(groupId);
      if (!groupState) {
        throw new Error('Group not found');
      }
      return groupState;
    } catch (error) {
      console.error('Failed to get group state:', error);
      throw error;
    }
  }
}

export default GroupCrypto;
