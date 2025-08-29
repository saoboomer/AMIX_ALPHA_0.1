import { AmiXStorage } from './storage';

/**
 * ThreadManager - Handles message threading and conversation organization
 */
export class ThreadManager {
  // Thread types
  static THREAD_TYPES = {
    DIRECT: 'direct',
    GROUP: 'group',
    ANNOUNCEMENT: 'announcement',
    TOPIC: 'topic'
  };

  // Thread visibility
  static VISIBILITY = {
    PUBLIC: 'public',
    PRIVATE: 'private',
    SECRET: 'secret'
  };

  /**
   * Create a new thread
   * @param {Object} options - Thread options
   * @param {string} options.conversationId - Parent conversation ID
   * @param {string} options.type - Thread type (DIRECT, GROUP, etc.)
   * @param {string} options.title - Thread title
   * @param {string} options.createdBy - User ID of creator
   * @param {Array} options.participants - Array of user IDs
   * @param {string} options.visibility - Thread visibility
   * @returns {Promise<string>} - Thread ID
   */
  static async createThread({
    conversationId,
    type = this.THREAD_TYPES.DIRECT,
    title = '',
    createdBy,
    participants = [],
    visibility = this.VISIBILITY.PRIVATE
  }) {
    try {
      const threadId = await AmiXCrypto.generateSecureUUID();
      const now = new Date().toISOString();
      
      const thread = {
        id: threadId,
        conversationId,
        type,
        title,
        createdBy,
        participants: [...new Set([...participants, createdBy])], // Ensure creator is included
        visibility,
        isArchived: false,
        isPinned: false,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: null,
        lastMessageId: null,
        metadata: {}
      };

      await AmiXStorage.storeThread(thread);
      return threadId;
    } catch (error) {
      console.error('Failed to create thread:', error);
      throw error;
    }
  }

  /**
   * Add a message to a thread
   * @param {string} threadId - Target thread ID
   * @param {Object} message - Message object
   * @param {string} message.id - Message ID
   * @param {string} message.senderId - Sender's user ID
   * @param {string} message.content - Message content
   * @param {Object} message.metadata - Additional metadata
   * @returns {Promise<Object>} - Updated thread
   */
  static async addMessageToThread(threadId, message) {
    try {
      const thread = await AmiXStorage.getThread(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      // Update thread metadata
      thread.updatedAt = new Date().toISOString();
      thread.lastMessageAt = message.createdAt || new Date().toISOString();
      thread.lastMessageId = message.id;
      thread.lastMessagePreview = this._truncateMessage(message.content, 100);
      thread.unreadCount = (thread.unreadCount || 0) + 1;

      // Store message with thread reference
      const messageWithThread = {
        ...message,
        threadId,
        conversationId: thread.conversationId
      };

      await AmiXStorage.storeMessage(thread.conversationId, messageWithThread);
      await AmiXStorage.updateThread(thread);

      return thread;
    } catch (error) {
      console.error('Failed to add message to thread:', error);
      throw error;
    }
  }

  /**
   * Get messages in a thread with pagination
   * @param {string} threadId - Thread ID
   * @param {Object} options - Pagination options
   * @param {number} options.limit - Number of messages to return
   * @param {string} options.before - Get messages before this timestamp
   * @returns {Promise<Array>} - Array of messages
   */
  static async getThreadMessages(threadId, { limit = 50, before = null } = {}) {
    try {
      const thread = await AmiXStorage.getThread(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      const query = {
        threadId,
        conversationId: thread.conversationId
      };

      if (before) {
        query.createdAt = { $lt: before };
      }

      return await AmiXStorage.getMessages(thread.conversationId, {
        query,
        limit,
        sort: { createdAt: -1 }
      });
    } catch (error) {
      console.error('Failed to get thread messages:', error);
      throw error;
    }
  }

  /**
   * Get all threads in a conversation
   * @param {string} conversationId - Parent conversation ID
   * @param {Object} options - Query options
   * @param {boolean} options.includeArchived - Include archived threads
   * @returns {Promise<Array>} - Array of threads
   */
  static async getThreadsInConversation(conversationId, { includeArchived = false } = {}) {
    try {
      const query = { conversationId };
      if (!includeArchived) {
        query.isArchived = false;
      }

      return await AmiXStorage.getThreads(query, { sort: { lastMessageAt: -1 } });
    } catch (error) {
      console.error('Failed to get conversation threads:', error);
      throw error;
    }
  }

  /**
   * Update thread metadata
   * @param {string} threadId - Thread ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} - Updated thread
   */
  static async updateThread(threadId, updates) {
    try {
      const thread = await AmiXStorage.getThread(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      const updatedThread = {
        ...thread,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await AmiXStorage.updateThread(updatedThread);
      return updatedThread;
    } catch (error) {
      console.error('Failed to update thread:', error);
      throw error;
    }
  }

  /**
   * Mark a thread as read
   * @param {string} threadId - Thread ID
   * @param {string} userId - User ID marking as read
   * @returns {Promise<Object>} - Updated thread
   */
  static async markThreadAsRead(threadId, userId) {
    try {
      const thread = await AmiXStorage.getThread(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      // Update read status for this user
      const readStatus = thread.readStatus || {};
      readStatus[userId] = new Date().toISOString();

      return await this.updateThread(threadId, {
        readStatus,
        unreadCount: 0
      });
    } catch (error) {
      console.error('Failed to mark thread as read:', error);
      throw error;
    }
  }

  // Helper method to truncate message for preview
  static _truncateMessage(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength 
      ? text.substring(0, maxLength) + '...' 
      : text;
  }
}

export default ThreadManager;
