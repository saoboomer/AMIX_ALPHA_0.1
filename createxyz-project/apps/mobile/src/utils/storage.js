import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AmiXCrypto } from "./crypto";
import Dexie from 'dexie';

// AmiX Secure Storage - Production-grade implementation
// Uses Expo SecureStore for sensitive data, AsyncStorage for non-sensitive data

export class AmiXStorage {
  // Storage keys for different data types
  static STORAGE_KEYS = {
    // Sensitive data (stored in SecureStore)
    IDENTITY_KEYS: 'amix_identity_keys',
    RATCHET_STATES: 'amix_ratchet_states',
    MESSAGES: 'amix_messages',
    CONTACTS: 'amix_contacts',
    GROUPS: 'amix_groups',
    ANALYTICS_UUID: 'amix_analytics_uuid',
    BACKUP_PASSPHRASE_HASH: 'amix_backup_passphrase_hash',
    
    // Non-sensitive data (stored in AsyncStorage)
    USER_PREFERENCES: 'amix_user_preferences',
    UI_STATE: 'amix_ui_state',
    CACHE_DATA: 'amix_cache_data',
    APP_VERSION: 'amix_app_version',
  };

  // Initialize storage and check for migrations
  static async initialize() {
    if (this.db) return this.db;
    
    this.db = new Dexie('AmiXDB');
    
    // Initial schema
    this.db.version(1).stores({
      messages: 'id, conversationId, threadId, createdAt, [conversationId+createdAt]',
      conversations: 'id, updatedAt',
      contacts: 'id, name',
      ratchetStates: 'id, groupId, senderId, recipientId, [groupId+senderId+recipientId]',
      settings: 'key',
      keyPairs: 'id',
      groups: 'id, [id+version]',
      threads: 'id, conversationId, [conversationId+updatedAt]',
    });
    
    // Add indexes for better query performance
    this.db.version(2).stores({
      messages: 'id, conversationId, threadId, createdAt, [conversationId+createdAt], [threadId+createdAt]',
      conversations: 'id, updatedAt, [type+updatedAt]',
      ratchetStates: 'id, groupId, senderId, recipientId, [groupId+senderId+recipientId], [groupId+updatedAt]',
      
      // Add reactions table
      reactions: 'id, messageId, userId, [messageId+userId], [messageId+emoji]',
      
      // Add reactions array to messages
    }).upgrade(tx => {
      return tx.table('messages').toCollection().modify(message => {
        message.reactions = [];
      });
    });
    
    // Add message type and reaction support
    this.db.version(3).stores({
      messages: 'id, conversationId, threadId, createdAt, type, [conversationId+createdAt], [threadId+createdAt]',
      reactions: 'id, messageId, userId, emoji, [messageId+userId], [messageId+emoji]',
      groups: 'id, [id+version], [updatedAt]',
      threads: 'id, conversationId, [conversationId+updatedAt], [conversationId+isPinned]',
    });
    
    // Add friend system tables
    this.db.version(4).stores({
      // Keep existing tables
      messages: 'id, conversationId, threadId, createdAt, type, [conversationId+createdAt], [threadId+createdAt]',
      reactions: 'id, messageId, userId, emoji, [messageId+userId], [messageId+emoji]',
      groups: 'id, [id+version], [updatedAt]',
      threads: 'id, conversationId, [conversationId+updatedAt], [conversationId+isPinned]',
      
      // Friend system tables
      users: 'id, username, publicKey, status, lastSeen, &username',
      friendRequests: 'id, fromUserId, toUserId, status, createdAt, [fromUserId+toUserId], [toUserId+status]',
      friendships: 'id, user1Id, user2Id, status, establishedAt, [user1Id+user2Id], [user1Id+status], [user2Id+status]',
      userSearch: 'username, userId, *searchTerms',
    });
    
    try {
      const appVersion = await this.getAppVersion();
      const currentVersion = '1.0.0'; // Update this with each release
      
      if (appVersion !== currentVersion) {
        await this.performMigration(appVersion, currentVersion);
        await this.setAppVersion(currentVersion);
      }
      
      return this.db;
    } catch (error) {
      console.error('Storage initialization failed:', error);
      return false;
    }
  }

  // Secure storage operations for sensitive data
  static async storeSecurely(key, value) {
    try {
      const encryptedValue = await this.encryptForStorage(value);
      await SecureStore.setItemAsync(key, encryptedValue);
      return true;
    } catch (error) {
      console.error('Secure storage failed:', error);
      return false;
    }
  }

  static async getSecurely(key) {
    try {
      const encryptedValue = await SecureStore.getItemAsync(key);
      if (!encryptedValue) return null;
      
      return await this.decryptFromStorage(encryptedValue);
    } catch (error) {
      console.error('Secure retrieval failed:', error);
      return null;
    }
  }

  static async deleteSecurely(key) {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (error) {
      console.error('Secure deletion failed:', error);
      return false;
    }
  }

  // Regular storage operations for non-sensitive data
  static async store(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Storage failed:', error);
      return false;
    }
  }

  static async get(key) {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Retrieval failed:', error);
      return null;
    }
  }

  static async delete(key) {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Deletion failed:', error);
      return false;
    }
  }

  // Database encryption for storage
  static async encryptForStorage(data) {
    try {
      // Generate a storage key from device-specific information
      const storageKey = await this.getStorageKey();
      const dataString = JSON.stringify(data);
      const dataBytes = new TextEncoder().encode(dataString);
      
      // Encrypt using AES-256-GCM equivalent (via tweetnacl)
      const nonce = await AmiXCrypto.generateRandomBytes(24);
      const encrypted = await AmiXCrypto.encryptMessage(dataString, {
        chainKey: storageKey
      });
      
      return JSON.stringify({
        encrypted: encrypted.ciphertext,
        nonce: encrypted.nonce,
        timestamp: Date.now()
      });
    } catch (error) {
      throw new Error('Encryption failed: ' + error.message);
    }
  }

  static async decryptFromStorage(encryptedData) {
    try {
      const data = JSON.parse(encryptedData);
      const storageKey = await this.getStorageKey();
      
      const decrypted = await AmiXCrypto.decryptMessage({
        ciphertext: data.encrypted,
        nonce: data.nonce
      }, {
        chainKey: storageKey
      });
      
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error('Decryption failed: ' + error.message);
    }
  }

  // Get device-specific storage key
  static async getStorageKey() {
    try {
      // Use device ID or generate a persistent key
      const deviceId = await SecureStore.getItemAsync('amix_device_id');
      if (!deviceId) {
        const newDeviceId = await AmiXCrypto.generateSecureUUID();
        await SecureStore.setItemAsync('amix_device_id', newDeviceId);
        return newDeviceId;
      }
      return deviceId;
    } catch (error) {
      // Fallback to a default key (less secure but functional)
      return 'amix_default_storage_key';
    }
  }

  // Identity and key management
  static async storeIdentityKeys(identityKeys) {
    // Ensure we're not storing expired or compromised keys
    const now = Date.now();
    
    if (identityKeys.current) {
      // Check if current key is expired
      if (identityKeys.current.expiresAt && identityKeys.current.expiresAt <= now) {
        throw new Error('Cannot store expired identity key');
      }
      
      // Ensure key has required properties
      if (!identityKeys.current.keyId || !identityKeys.current.privateKey || !identityKeys.current.publicKey) {
        throw new Error('Invalid identity key format');
      }
    }
    
    // Validate previous keys
    if (identityKeys.previous && Array.isArray(identityKeys.previous)) {
      identityKeys.previous = identityKeys.previous.filter(key => 
        key && 
        key.keyId && 
        key.publicKey && 
        (!key.expiresAt || key.expiresAt > now) &&
        !key.isCompromised
      );
    }
    
    return await this.storeSecurely(this.STORAGE_KEYS.IDENTITY_KEYS, identityKeys);
  }

  static async getIdentityKeys() {
    const keys = await this.getSecurely(this.STORAGE_KEYS.IDENTITY_KEYS);
    
    // Migrate from old format if needed
    if (keys && keys.privateKey && keys.publicKey) {
      const newKeys = await AmiXCrypto.generateIdentityKeys();
      newKeys.current = {
        ...newKeys.current,
        privateKey: keys.privateKey,
        publicKey: keys.publicKey,
        keyId: 'legacy-key',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30, // 30 days ago
        expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 60, // 60 days from now
      };
      
      await this.storeIdentityKeys(newKeys);
      return newKeys;
    }
    
    return keys;
  }

  // Get current public key in a backward-compatible way
  static async getCurrentPublicKey() {
    const keys = await this.getIdentityKeys();
    if (!keys) return null;
    
    // Handle both old and new key formats
    return keys.current ? keys.current.publicKey : keys.publicKey;
  }

  // Get current private key in a backward-compatible way
  static async getCurrentPrivateKey() {
    const keys = await this.getIdentityKeys();
    if (!keys) return null;
    
    // Handle both old and new key formats
    return keys.current ? keys.current.privateKey : keys.privateKey;
  }

  static async storeRatchetState(conversationId, ratchetState) {
    try {
      const states = await this.getSecurely(this.STORAGE_KEYS.RATCHET_STATES) || {};
      
      // Create a deep copy to avoid reference issues
      const stateCopy = JSON.parse(JSON.stringify(ratchetState));
      
      // Store the updated state
      states[conversationId] = stateCopy;
      await this.storeSecurely(this.STORAGE_KEYS.RATCHET_STATES, states);
      
      return stateCopy;
    } catch (error) {
      console.error('Error storing ratchet state:', error);
      throw error;
    }
  }

  static async getRatchetState(conversationId) {
    try {
      const states = await this.getSecurely(this.STORAGE_KEYS.RATCHET_STATES) || {};
      return states[conversationId] || null;
    } catch (error) {
      console.error('Error getting ratchet state:', error);
      return null;
    }
  }

  // Add or update a reaction to a message
  static async addReaction(messageId, userId, emoji) {
    try {
      const db = await this.getDatabase();
      const reactionId = await AmiXCrypto.generateSecureUUID();
      const now = new Date().toISOString();
      
      // Check if user already reacted with this emoji
      const existingReaction = await db.reactions
        .where('[messageId+userId+emoji]')
        .equals([messageId, userId, emoji])
        .first();
      
      if (existingReaction) {
        // Remove reaction if it exists
        await db.reactions.delete(existingReaction.id);
        return { action: 'removed', reaction: null };
      }
      
      // Remove any existing reaction from this user to this message
      await db.reactions
        .where('[messageId+userId]')
        .equals([messageId, userId])
        .delete();
      
      // Add new reaction
      const reaction = {
        id: reactionId,
        messageId,
        userId,
        emoji,
        createdAt: now,
        updatedAt: now
      };
      
      await db.reactions.add(reaction);
      
      // Update message's reactions summary
      await db.messages.update(messageId, {
        updatedAt: now,
        hasReactions: true
      });
      
      return { action: 'added', reaction };
    } catch (error) {
      console.error('Failed to add reaction:', error);
      throw error;
    }
  }
  
  // Get reactions for a message
  static async getMessageReactions(messageId) {
    try {
      const db = await this.getDatabase();
      return await db.reactions
        .where('messageId')
        .equals(messageId)
        .toArray();
    } catch (error) {
      console.error('Failed to get message reactions:', error);
      throw error;
    }
  }
  
  // Get reaction summary for a message (count by emoji)
  static async getReactionSummary(messageId) {
    try {
      const db = await this.getDatabase();
      const reactions = await db.reactions
        .where('messageId')
        .equals(messageId)
        .toArray();
      
      // Group by emoji and count
      const summary = {};
      reactions.forEach(reaction => {
        if (!summary[reaction.emoji]) {
          summary[reaction.emoji] = {
            count: 0,
            users: []
          };
        }
        summary[reaction.emoji].count++;
        summary[reaction.emoji].users.push(reaction.userId);
      });
      
      return summary;
    } catch (error) {
      console.error('Failed to get reaction summary:', error);
      throw error;
    }
  }

  // Message storage with encryption support
  static async storeMessage(conversationId, message) {
    try {
      const db = await this.getDatabase();
      await db.transaction('rw', db.messages, async () => {
        // Store message
        await db.messages.put({
          id: message.id,
          conversationId,
          ...message,
          createdAt: message.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        
        // Update conversation's last message and timestamp
        await db.conversations.update(conversationId, {
          lastMessage: message.text,
          lastMessageAt: message.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });
    } catch (error) {
      console.error('Failed to store message:', error);
      throw error;
    }
  }

  static async updateMessage(messageId, updates) {
    try {
      const db = await this.getDatabase();
      await db.messages.update(messageId, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      
      // If status changed, update conversation
      if (updates.status) {
        const message = await db.messages.get(messageId);
        if (message) {
          await db.conversations.update(message.conversationId, {
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to update message:', error);
      throw error;
    }
  }

  static async getMessage(messageId) {
    try {
      const db = await this.getDatabase();
      return await db.messages.get(messageId);
    } catch (error) {
      console.error('Failed to get message:', error);
      throw error;
    }
  }

  static async getMessages(conversationId, options = {}) {
    try {
      const { limit = 50, before = new Date().toISOString() } = options;
      const db = await this.getDatabase();
      
      return await db.messages
        .where('conversationId').equals(conversationId)
        .and(message => new Date(message.createdAt) <= new Date(before))
        .reverse()
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('Failed to get messages:', error);
      throw error;
    }
  }

  static async createConversation(conversation) {
    try {
      const db = await this.getDatabase();
      const id = conversation.id || await AmiXCrypto.generateSecureUUID();
      
      await db.conversations.put({
        id,
        name: conversation.name,
        type: conversation.type || 'direct',
        participants: conversation.participants || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...conversation,
      });
      
      return id;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }

  static async updateConversation(conversationId, updates) {
    try {
      const db = await this.getDatabase();
      await db.conversations.update(conversationId, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to update conversation:', error);
      throw error;
    }
  }

  static async getConversation(conversationId) {
    try {
      const db = await this.getDatabase();
      return await db.conversations.get(conversationId);
    } catch (error) {
      console.error('Failed to get conversation:', error);
      throw error;
    }
  }

  static async getAllConversations() {
    try {
      const db = await this.getDatabase();
      return await db.conversations
        .orderBy('updatedAt')
        .reverse()
        .toArray();
    } catch (error) {
      console.error('Failed to get conversations:', error);
      throw error;
    }
  }

  // Thread storage methods
  static async storeThread(thread) {
    try {
      const db = await this.getDatabase();
      await db.threads.put(thread);
      return thread.id;
    } catch (error) {
      console.error('Failed to store thread:', error);
      throw error;
    }
  }

  static async getThread(threadId) {
    try {
      const db = await this.getDatabase();
      return await db.threads.get(threadId);
    } catch (error) {
      console.error('Failed to get thread:', error);
      throw error;
    }
  }

  static async updateThread(thread) {
    try {
      const db = await this.getDatabase();
      await db.threads.update(thread.id, {
        ...thread,
        updatedAt: new Date().toISOString()
      });
      return thread.id;
    } catch (error) {
      console.error('Failed to update thread:', error);
      throw error;
    }
  }

  static async getThreads(query = {}, options = {}) {
    try {
      const db = await this.getDatabase();
      let collection = db.threads;
      
      // Apply filters
      if (query.conversationId) {
        collection = collection.where('conversationId').equals(query.conversationId);
      }
      
      if (query.isArchived !== undefined) {
        collection = collection.where('isArchived').equals(query.isArchived);
      }
      
      // Apply sorting
      if (options.sort) {
        Object.entries(options.sort).forEach(([field, direction]) => {
          collection = collection.orderBy(field);
          if (direction === -1) {
            collection = collection.reverse();
          }
        });
      }
      
      // Apply pagination
      if (options.limit) {
        collection = collection.limit(options.limit);
      }
      
      return await collection.toArray();
    } catch (error) {
      console.error('Failed to get threads:', error);
      throw error;
    }
  }

  // Contact management with verification support
  static async storeContact(contact) {
    try {
      const contacts = await this.getSecurely(this.STORAGE_KEYS.CONTACTS) || {};
      const existingContact = contacts[contact.id] || {};
      
      // Preserve verification status if contact already exists
      const updatedContact = {
        ...existingContact,
        ...contact,
        // Only update verification status if explicitly provided
        verified: contact.verified !== undefined ? contact.verified : (existingContact.verified || false)
      };
      
      contacts[contact.id] = updatedContact;
      await this.storeSecurely(this.STORAGE_KEYS.CONTACTS, contacts);
      return updatedContact;
    } catch (error) {
      console.error('Error storing contact:', error);
      throw error;
    }
  }

  static async updateContact(contactId, updates) {
    try {
      const contacts = await this.getSecurely(this.STORAGE_KEYS.CONTACTS) || {};
      if (!contacts[contactId]) {
        return null;
      }
      
      // Don't allow updating the ID
      const { id, ...safeUpdates } = updates;
      
      // Create a new object to ensure state updates are detected
      const updatedContact = {
        ...contacts[contactId],
        ...safeUpdates,
        lastUpdated: new Date().toISOString()
      };
      
      contacts[contactId] = updatedContact;
      await this.storeSecurely(this.STORAGE_KEYS.CONTACTS, contacts);
      
      return updatedContact;
    } catch (error) {
      console.error('Error updating contact:', error);
      throw error;
    }
  }

  static async getContacts() {
    try {
      const contacts = await this.getSecurely(this.STORAGE_KEYS.CONTACTS) || {};
      
      // Convert to array and sort by most recently updated
      return Object.entries(contacts)
        .map(([id, contact]) => ({
          id,
          ...contact,
          lastUpdated: contact.lastUpdated || new Date(0).toISOString()
        }))
        .sort((a, b) => 
          new Date(b.lastUpdated) - new Date(a.lastUpdated)
        )
        .reduce((acc, contact) => {
          acc[contact.id] = contact;
          return acc;
        }, {});
    } catch (error) {
      console.error('Error getting contacts:', error);
      return {};
    }
  }

  // Group management
  static async storeGroup(group) {
    try {
      const db = await this.getDatabase();
      await db.groups.put(group);
      return group.id;
    } catch (error) {
      console.error('Failed to store group:', error);
      throw error;
    }
  }

  static async getGroup(groupId) {
    try {
      const db = await this.getDatabase();
      return await db.groups.get(groupId);
    } catch (error) {
      console.error('Failed to get group:', error);
      throw error;
    }
  }

  static async updateGroup(group) {
    try {
      const db = await this.getDatabase();
      await db.groups.update(group.id, {
        ...group,
        updatedAt: new Date().toISOString()
      });
      return group.id;
    } catch (error) {
      console.error('Failed to update group:', error);
      throw error;
    }
  }

  static async storeRatchetState(ratchetState) {
    try {
      const db = await this.getDatabase();
      const id = `${ratchetState.groupId}:${ratchetState.senderId}:${ratchetState.recipientId}`;
      await db.ratchetStates.put({
        id,
        ...ratchetState
      });
      return id;
    } catch (error) {
      console.error('Failed to store ratchet state:', error);
      throw error;
    }
  }

  static async getRatchetState(groupId, senderId, recipientId) {
    try {
      const db = await this.getDatabase();
      const id = `${groupId}:${senderId}:${recipientId}`;
      return await db.ratchetStates.get(id);
    } catch (error) {
      console.error('Failed to get ratchet state:', error);
      throw error;
    }
  }

  static async updateRatchetState(ratchetState) {
    try {
      const db = await this.getDatabase();
      const id = `${ratchetState.groupId}:${ratchetState.senderId}:${ratchetState.recipientId}`;
      await db.ratchetStates.update(id, {
        ...ratchetState,
        updatedAt: new Date().toISOString()
      });
      return id;
    } catch (error) {
      console.error('Failed to update ratchet state:', error);
      throw error;
    }
  }

  // Secure backup and restore
  static async createBackup(passphrase) {
    try {
      // Hash the passphrase
      const passphraseHash = await AmiXCrypto.generateSafetyNumber(passphrase, 'amix_backup');
      
      // Collect all sensitive data
      const backupData = {
        identityKeys: await this.getIdentityKeys(),
        ratchetStates: await this.getSecurely(this.STORAGE_KEYS.RATCHET_STATES),
        messages: await this.getSecurely(this.STORAGE_KEYS.MESSAGES),
        contacts: await this.getSecurely(this.STORAGE_KEYS.CONTACTS),
        groups: await this.getSecurely(this.STORAGE_KEYS.GROUPS),
        timestamp: Date.now(),
        version: '1.0.0'
      };
      
      // Encrypt backup with passphrase
      const backupString = JSON.stringify(backupData);
      const backupKey = await AmiXCrypto.deriveKey(
        new TextEncoder().encode(passphrase),
        'amix_backup_key'
      );
      
      const encryptedBackup = await AmiXCrypto.encryptMessage(backupString, {
        chainKey: AmiXCrypto.bytesToHex(backupKey)
      });
      
      // Store passphrase hash for verification
      await this.storeSecurely(this.STORAGE_KEYS.BACKUP_PASSPHRASE_HASH, passphraseHash);
      
      return {
        encryptedData: encryptedBackup.ciphertext,
        nonce: encryptedBackup.nonce,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error('Backup creation failed: ' + error.message);
    }
  }

  static async restoreBackup(encryptedBackup, passphrase) {
    try {
      // Verify passphrase
      const storedHash = await this.getSecurely(this.STORAGE_KEYS.BACKUP_PASSPHRASE_HASH);
      const inputHash = await AmiXCrypto.generateSafetyNumber(passphrase, 'amix_backup');
      
      if (storedHash !== inputHash) {
        throw new Error('Invalid passphrase');
      }
      
      // Decrypt backup
      const backupKey = await AmiXCrypto.deriveKey(
        new TextEncoder().encode(passphrase),
        'amix_backup_key'
      );
      
      const decryptedBackup = await AmiXCrypto.decryptMessage({
        ciphertext: encryptedBackup.encryptedData,
        nonce: encryptedBackup.nonce
      }, {
        chainKey: AmiXCrypto.bytesToHex(backupKey)
      });
      
      const backupData = JSON.parse(decryptedBackup);
      
      // Restore all data
      await this.storeIdentityKeys(backupData.identityKeys);
      await this.storeSecurely(this.STORAGE_KEYS.RATCHET_STATES, backupData.ratchetStates);
      await this.storeSecurely(this.STORAGE_KEYS.MESSAGES, backupData.messages);
      await this.storeSecurely(this.STORAGE_KEYS.CONTACTS, backupData.contacts);
      await this.storeSecurely(this.STORAGE_KEYS.GROUPS, backupData.groups);
      
      return true;
    } catch (error) {
      throw new Error('Backup restoration failed: ' + error.message);
    }
  }

  // Secure deletion
  static async secureDelete() {
    try {
      // Delete all sensitive data
      const keys = Object.values(this.STORAGE_KEYS);
      for (const key of keys) {
        await this.deleteSecurely(key);
      }
      
      // Clear non-sensitive data
      await AsyncStorage.clear();
      
      return true;
    } catch (error) {
      console.error('Secure deletion failed:', error);
      return false;
    }
  }

  // Database migration
  static async performMigration(fromVersion, toVersion) {
    try {
      console.log(`Migrating from ${fromVersion} to ${toVersion}`);
      
      // Add migration logic here as needed
      // For now, just log the migration
      
      return true;
    } catch (error) {
      console.error('Migration failed:', error);
      return false;
    }
  }

  // App version management
  static async getAppVersion() {
    return await this.get(this.STORAGE_KEYS.APP_VERSION) || '0.0.0';
  }

  static async setAppVersion(version) {
    return await this.store(this.STORAGE_KEYS.APP_VERSION, version);
  }

  // Utility functions
  static async getAllKeys() {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('Failed to get all keys:', error);
      return [];
    }
  }

  static async getStorageSize() {
    try {
      const keys = await this.getAllKeys();
      let totalSize = 0;
      
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }
      
      return totalSize;
    } catch (error) {
      console.error('Failed to calculate storage size:', error);
      return 0;
    }
  }

  static async getDatabase() {
    return await this.initialize();
  }
}
