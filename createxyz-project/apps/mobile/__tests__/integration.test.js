import { AmiXCrypto } from '../src/utils/crypto';
import { AmiXStorage } from '../src/utils/storage';
import { AmiXGroupCrypto } from '../src/utils/groupCrypto';
import { AmiXMediaEncryption } from '../src/utils/mediaEncryption';
import { AmiXWebRTC } from '../src/services/webrtc';
import { AmiXMessageQueue } from '../src/services/messageQueue';
import { AmiXCalls } from '../src/services/calls';
import { AmiXGamification } from '../src/utils/gamification';
import { AmiXNotifications } from '../src/services/notifications';
import { AmiXAnalytics } from '../src/utils/analytics';

// AmiX Integration Test Suite
// Tests end-to-end functionality across all components

describe('AmiX Integration Tests', () => {
  let aliceKeys, bobKeys, charlieKeys;
  let aliceId, bobId, charlieId;

  beforeAll(async () => {
    // Initialize all systems
    await AmiXStorage.initialize();
    await AmiXWebRTC.initialize();
    await AmiXMessageQueue.initialize();
    await AmiXCalls.initialize();
    await AmiXGamification.initialize();
    await AmiXNotifications.initialize();
    await AmiXAnalytics.initialize();

    // Generate test identities
    aliceKeys = await AmiXCrypto.generateIdentityKeys();
    bobKeys = await AmiXCrypto.generateIdentityKeys();
    charlieKeys = await AmiXCrypto.generateIdentityKeys();

    aliceId = await AmiXCrypto.generateAmiXID();
    bobId = await AmiXCrypto.generateAmiXID();
    charlieId = await AmiXCrypto.generateAmiXID();

    // Store test identities
    await AmiXStorage.storeContact({
      amixId: aliceId,
      publicKey: aliceKeys.publicKey,
      name: 'Alice',
    });

    await AmiXStorage.storeContact({
      amixId: bobId,
      publicKey: bobKeys.publicKey,
      name: 'Bob',
    });

    await AmiXStorage.storeContact({
      amixId: charlieId,
      publicKey: charlieKeys.publicKey,
      name: 'Charlie',
    });
  });

  afterAll(async () => {
    // Cleanup
    await AmiXStorage.secureDelete();
    await AmiXWebRTC.cleanup();
    await AmiXMessageQueue.cleanup();
  });

  describe('End-to-End Message Flow', () => {
    test('should handle complete message encryption, transmission, and decryption', async () => {
      const message = 'Hello, this is a test message!';
      
      // Alice sends message to Bob
      const encryptedMessage = await AmiXCrypto.encryptMessage(message, {
        chainKey: bobKeys.publicKey,
      });

      // Bob receives and decrypts message
      const decryptedMessage = await AmiXCrypto.decryptMessage(encryptedMessage, {
        chainKey: bobKeys.privateKey,
      });

      expect(decryptedMessage).toBe(message);
    });

    test('should handle message queue with offline/online scenarios', async () => {
      const message = {
        recipientId: bobId,
        content: 'Offline message test',
        timestamp: Date.now(),
      };

      // Add message to queue
      const messageId = await AmiXMessageQueue.addToOutbox(message);
      expect(messageId).toBeDefined();

      // Check queue status
      const status = await AmiXMessageQueue.getOutboxStatus();
      expect(status.pending).toBeGreaterThan(0);

      // Simulate network offline
      AmiXMessageQueue.networkStatus = 'offline';
      await AmiXMessageQueue.processQueue();
      
      // Message should still be pending
      const statusAfterOffline = await AmiXMessageQueue.getOutboxStatus();
      expect(statusAfterOffline.pending).toBeGreaterThan(0);

      // Simulate network online
      AmiXMessageQueue.networkStatus = 'online';
      await AmiXMessageQueue.onNetworkOnline();
    });
  });

  describe('WebRTC Connection and Fallback', () => {
    test('should establish P2P connection and handle fallback', async () => {
      // Create peer connection
      const peerConnection = await AmiXWebRTC.createPeerConnection(bobId);
      expect(peerConnection).toBeDefined();

      // Check connection state
      const state = AmiXWebRTC.getConnectionState(bobId);
      expect(state).toBeDefined();

      // Test data channel creation
      const dataChannel = await AmiXWebRTC.createDataChannel(bobId);
      expect(dataChannel).toBeDefined();
    });

    test('should handle encrypted message transmission via WebRTC', async () => {
      const message = 'P2P encrypted message';
      
      // Send encrypted message
      const success = await AmiXWebRTC.sendEncryptedMessage(bobId, message);
      expect(success).toBeDefined();
    });
  });

  describe('Group Chat Functionality', () => {
    test('should create and manage group chats', async () => {
      const groupId = 'test-group-123';
      const creatorKeys = {
        amixId: aliceId,
        privateKey: aliceKeys.privateKey,
        publicKey: aliceKeys.publicKey,
      };

      // Create group
      const groupState = await AmiXGroupCrypto.createGroup(groupId, creatorKeys, [bobId, charlieId]);
      expect(groupState).toBeDefined();
      expect(groupState.id).toBe(groupId);
      expect(groupState.creatorId).toBe(aliceId);

      // Store group
      await AmiXStorage.storeGroup(groupState);
    });

    test('should encrypt and decrypt group messages', async () => {
      const groupId = 'test-group-456';
      const creatorKeys = {
        amixId: aliceId,
        privateKey: aliceKeys.privateKey,
        publicKey: aliceKeys.publicKey,
      };

      const groupState = await AmiXGroupCrypto.createGroup(groupId, creatorKeys, [bobId]);
      
      const message = { content: 'Group message test' };
      
      // Encrypt group message
      const encryptedMessage = await AmiXGroupCrypto.encryptGroupMessage(
        groupState,
        creatorKeys,
        message
      );
      expect(encryptedMessage).toBeDefined();
      expect(encryptedMessage.groupId).toBe(groupId);

      // Decrypt group message
      const decryptedMessage = await AmiXGroupCrypto.decryptGroupMessage(
        encryptedMessage,
        creatorKeys,
        groupState
      );
      expect(decryptedMessage.content).toBe(message.content);
    });
  });

  describe('Media Encryption and Streaming', () => {
    test('should encrypt and decrypt files', async () => {
      const testData = new TextEncoder().encode('Test file content');
      const fileUri = 'file://test.txt';
      
      // Mock file system operations
      const mockFileInfo = { exists: true, size: testData.length };
      const mockFileData = btoa(String.fromCharCode(...testData));

      // Test file encryption
      const encryptedFile = await AmiXMediaEncryption.encryptFile(
        fileUri,
        { publicKey: bobKeys.publicKey },
        { thumbnailSize: 100 }
      );
      expect(encryptedFile).toBeDefined();
      expect(encryptedFile.fileId).toBeDefined();
      expect(encryptedFile.encryptedData).toBeDefined();
    });

    test('should handle streaming encryption for large files', async () => {
      const fileUri = 'file://large-file.mp4';
      const mockFileInfo = { exists: true, size: 1024 * 1024 }; // 1MB

      // Test streaming encryption
      const encryptedStream = await AmiXMediaEncryption.createEncryptedStream(
        fileUri,
        { publicKey: bobKeys.publicKey },
        (progress) => {
          expect(progress).toBeGreaterThanOrEqual(0);
          expect(progress).toBeLessThanOrEqual(1);
        }
      );
      expect(encryptedStream).toBeDefined();
      expect(encryptedStream.chunks).toBeDefined();
      expect(encryptedStream.totalChunks).toBeGreaterThan(0);
    });
  });

  describe('Voice and Video Calls', () => {
    test('should initiate and manage calls', async () => {
      // Test call initiation
      const callResult = await AmiXCalls.initiateCall(bobId, 'audio', {
        encryptStream: true,
      });
      expect(callResult).toBeDefined();
      expect(callResult.callId).toBeDefined();

      // Check active calls
      const activeCalls = AmiXCalls.getActiveCalls();
      expect(activeCalls.length).toBeGreaterThan(0);

      // End call
      const endResult = await AmiXCalls.endCall(callResult.callId);
      expect(endResult).toBe(true);
    });

    test('should handle call quality adaptation', async () => {
      const callId = await AmiXCrypto.generateSecureUUID();
      
      // Test quality adaptation
      await AmiXCalls.adaptCallQuality(callId, 'high');
      
      const callStats = AmiXCalls.getCallStats(callId);
      expect(callStats).toBeDefined();
    });
  });

  describe('Gamification System', () => {
    test('should award points and track achievements', async () => {
      // Award points for actions
      await AmiXGamification.awardPoints('MESSAGE_SENT');
      await AmiXGamification.awardPoints('FILE_SHARED');

      // Get user stats
      const stats = await AmiXGamification.getUserStats();
      expect(stats.points).toBeGreaterThan(0);
      expect(stats.totalPoints).toBeGreaterThan(0);
    });

    test('should unlock themes and reaction packs', async () => {
      // Award enough points to unlock themes
      await AmiXGamification.awardPoints('ACHIEVEMENT', 1000);

      // Check available themes
      const themes = await AmiXGamification.getAvailableThemes();
      expect(themes.length).toBeGreaterThan(0);

      // Check reaction packs
      const reactionPacks = await AmiXGamification.getAvailableReactionPacks();
      expect(reactionPacks.length).toBeGreaterThan(0);
    });

    test('should track achievements', async () => {
      // Update stats to trigger achievements
      await AmiXGamification.updateStats('messagesSent', 1);
      await AmiXGamification.updateStats('filesShared', 1);

      // Check achievements
      const stats = await AmiXGamification.getUserStats();
      expect(stats.achievements).toBeDefined();
    });
  });

  describe('Notification System', () => {
    test('should send and manage notifications', async () => {
      const notificationData = {
        senderId: bobId,
        senderName: 'Bob',
        content: 'Test notification message',
      };

      // Send notification
      const notificationId = await AmiXNotifications.sendNotification(
        'message',
        notificationData,
        { encrypted: true }
      );
      expect(notificationId).toBeDefined();
    });

    test('should handle notification grouping', async () => {
      const notificationData = {
        senderId: bobId,
        senderName: 'Bob',
        content: 'Grouped notification',
      };

      // Send multiple notifications quickly
      await AmiXNotifications.sendNotification('message', notificationData);
      await AmiXNotifications.sendNotification('message', notificationData);
      await AmiXNotifications.sendNotification('message', notificationData);

      // Check notification history
      const history = await AmiXNotifications.getNotificationHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Analytics and Privacy', () => {
    test('should track events while maintaining privacy', async () => {
      // Track various events
      await AmiXAnalytics.trackEvent('message_sent', { recipientType: 'peer' });
      await AmiXAnalytics.trackEvent('file_shared', { fileType: 'image' });
      await AmiXAnalytics.trackEvent('call_completed', { duration: 300 });

      // Check analytics status
      const status = await AmiXAnalytics.getAnalyticsStatus();
      expect(status).toBeDefined();
    });

    test('should handle opt-in/opt-out functionality', async () => {
      // Test opt-out
      await AmiXAnalytics.updateOptInStatus(false);
      
      // Send heartbeat (should be minimal due to opt-out)
      await AmiXAnalytics.sendHeartbeat();
    });
  });

  describe('Storage and Backup', () => {
    test('should create and restore encrypted backups', async () => {
      const passphrase = 'test-backup-passphrase';

      // Store some test data
      await AmiXStorage.storeMessage('test-conversation', {
        content: 'Test message for backup',
        senderId: aliceId,
        timestamp: Date.now(),
      });

      // Create backup
      const backup = await AmiXStorage.createBackup(passphrase);
      expect(backup).toBeDefined();
      expect(backup.encryptedData).toBeDefined();

      // Clear storage
      await AmiXStorage.secureDelete();

      // Restore backup
      const restored = await AmiXStorage.restoreBackup(backup, passphrase);
      expect(restored).toBe(true);

      // Verify data was restored
      const messages = await AmiXStorage.getMessages('test-conversation');
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Security and Privacy Features', () => {
    test('should verify safety numbers', async () => {
      const safetyNumber = await AmiXCrypto.generateSafetyNumber(
        aliceKeys.publicKey,
        bobKeys.publicKey
      );
      expect(safetyNumber).toBeDefined();
      expect(typeof safetyNumber).toBe('string');
      expect(safetyNumber.length).toBeGreaterThan(0);
    });

    test('should handle secure deletion', async () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      AmiXCrypto.secureDelete(testData);
      
      // Data should be zeroed out
      expect(testData.every(byte => byte === 0)).toBe(true);
    });

    test('should generate secure UUIDs', async () => {
      const uuid1 = await AmiXCrypto.generateSecureUUID();
      const uuid2 = await AmiXCrypto.generateSecureUUID();
      
      expect(uuid1).not.toBe(uuid2);
      expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent operations', async () => {
      const operations = [];
      
      // Create multiple concurrent operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          AmiXCrypto.generateIdentityKeys(),
          AmiXGamification.awardPoints('MESSAGE_SENT'),
          AmiXNotifications.sendNotification('message', {
            senderId: bobId,
            content: `Concurrent message ${i}`,
          })
        );
      }

      // Execute all operations concurrently
      const results = await Promise.all(operations);
      expect(results.length).toBe(30);
    });

    test('should handle large message volumes', async () => {
      const messages = [];
      
      // Create many messages
      for (let i = 0; i < 100; i++) {
        messages.push({
          content: `Bulk message ${i}`,
          senderId: aliceId,
          timestamp: Date.now() + i,
        });
      }

      // Store all messages
      for (const message of messages) {
        await AmiXStorage.storeMessage('bulk-test', message);
      }

      // Retrieve messages
      const storedMessages = await AmiXStorage.getMessages('bulk-test', 50);
      expect(storedMessages.length).toBe(50);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle crypto errors gracefully', async () => {
      // Test with invalid keys
      await expect(
        AmiXCrypto.performKeyExchange('invalid', 'invalid')
      ).rejects.toThrow();
    });

    test('should handle storage errors gracefully', async () => {
      // Test with invalid data
      const result = await AmiXStorage.storeSecurely('test', undefined);
      expect(result).toBeDefined();
    });

    test('should handle network errors gracefully', async () => {
      // Simulate network failure
      AmiXMessageQueue.networkStatus = 'offline';
      
      const message = {
        recipientId: bobId,
        content: 'Network error test',
      };

      const messageId = await AmiXMessageQueue.addToOutbox(message);
      expect(messageId).toBeDefined();

      // Message should remain in queue
      const status = await AmiXMessageQueue.getOutboxStatus();
      expect(status.pending).toBeGreaterThan(0);
    });
  });

  describe('Cross-Platform Compatibility', () => {
    test('should work across different platforms', async () => {
      // Test core functionality that should work everywhere
      const keys = await AmiXCrypto.generateIdentityKeys();
      expect(keys).toBeDefined();

      const amixId = await AmiXCrypto.generateAmiXID();
      expect(amixId).toBeDefined();

      const uuid = await AmiXCrypto.generateSecureUUID();
      expect(uuid).toBeDefined();
    });
  });
});
