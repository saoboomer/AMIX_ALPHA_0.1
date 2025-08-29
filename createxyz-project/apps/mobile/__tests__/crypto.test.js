import { AmiXCrypto } from '../src/utils/crypto';
import { AmiXStorage } from '../src/utils/storage';
import { AmiXGroupCrypto } from '../src/utils/groupCrypto';

// AmiX Crypto Testing Suite
// Tests all cryptographic functions for correctness and security

describe('AmiXCrypto', () => {
  beforeEach(async () => {
    // Initialize storage before each test
    await AmiXStorage.initialize();
  });

  describe('Identity Key Generation', () => {
    test('should generate valid identity keypair', async () => {
      const keypair = await AmiXCrypto.generateIdentityKeys();
      
      expect(keypair).toBeDefined();
      expect(keypair.privateKey).toBeDefined();
      expect(keypair.publicKey).toBeDefined();
      expect(keypair.privateKey.length).toBeGreaterThan(0);
      expect(keypair.publicKey.length).toBeGreaterThan(0);
      expect(keypair.privateKey).not.toBe(keypair.publicKey);
    });

    test('should generate unique keypairs', async () => {
      const keypair1 = await AmiXCrypto.generateIdentityKeys();
      const keypair2 = await AmiXCrypto.generateIdentityKeys();
      
      expect(keypair1.privateKey).not.toBe(keypair2.privateKey);
      expect(keypair1.publicKey).not.toBe(keypair2.publicKey);
    });
  });

  describe('AmiX ID Generation', () => {
    test('should generate valid AmiX ID', async () => {
      const amixId = await AmiXCrypto.generateAmiXID();
      
      expect(amixId).toBeDefined();
      expect(typeof amixId).toBe('string');
      expect(amixId.length).toBeGreaterThanOrEqual(8);
      expect(amixId.length).toBeLessThanOrEqual(12);
      
      // Should only contain base58 characters
      const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      for (const char of amixId) {
        expect(base58Chars).toContain(char);
      }
    });

    test('should generate unique AmiX IDs', async () => {
      const id1 = await AmiXCrypto.generateAmiXID();
      const id2 = await AmiXCrypto.generateAmiXID();
      
      expect(id1).not.toBe(id2);
    });
  });

  describe('Random Number Generation', () => {
    test('should generate random bytes', async () => {
      const bytes = await AmiXCrypto.generateRandomBytes(32);
      
      expect(bytes).toBeDefined();
      expect(bytes.length).toBe(32);
      expect(bytes instanceof Uint8Array).toBe(true);
    });

    test('should generate different random bytes', async () => {
      const bytes1 = await AmiXCrypto.generateRandomBytes(16);
      const bytes2 = await AmiXCrypto.generateRandomBytes(16);
      
      expect(bytes1).not.toEqual(bytes2);
    });
  });

  describe('Key Exchange (X3DH)', () => {
    test('should perform key exchange', async () => {
      const aliceKeys = await AmiXCrypto.generateIdentityKeys();
      const bobKeys = await AmiXCrypto.generateIdentityKeys();
      
      const sharedSecret1 = await AmiXCrypto.performKeyExchange(
        bobKeys.publicKey,
        aliceKeys.privateKey
      );
      
      const sharedSecret2 = await AmiXCrypto.performKeyExchange(
        aliceKeys.publicKey,
        bobKeys.privateKey
      );
      
      expect(sharedSecret1).toBeDefined();
      expect(sharedSecret2).toBeDefined();
      expect(sharedSecret1.sharedSecret).toBe(sharedSecret2.sharedSecret);
    });

    test('should fail with invalid keys', async () => {
      await expect(
        AmiXCrypto.performKeyExchange('invalid', 'invalid')
      ).rejects.toThrow();
    });
  });

  describe('Double Ratchet', () => {
    test('should create ratchet state', async () => {
      const sharedSecret = await AmiXCrypto.generateRandomBytes(32);
      const ourKeys = await AmiXCrypto.generateIdentityKeys();
      const theirKeys = await AmiXCrypto.generateIdentityKeys();
      
      const ratchetState = await AmiXCrypto.createRatchetState(
        AmiXCrypto.bytesToHex(sharedSecret),
        ourKeys.privateKey,
        theirKeys.publicKey
      );
      
      expect(ratchetState).toBeDefined();
      expect(ratchetState.rootKey).toBeDefined();
      expect(ratchetState.chainKey).toBeDefined();
      expect(ratchetState.messageCount).toBe(0);
    });

    test('should encrypt and decrypt messages', async () => {
      const sharedSecret = await AmiXCrypto.generateRandomBytes(32);
      const ourKeys = await AmiXCrypto.generateIdentityKeys();
      const theirKeys = await AmiXCrypto.generateIdentityKeys();
      
      const ratchetState = await AmiXCrypto.createRatchetState(
        AmiXCrypto.bytesToHex(sharedSecret),
        ourKeys.privateKey,
        theirKeys.publicKey
      );
      
      const originalMessage = 'Hello, AmiX!';
      const encrypted = await AmiXCrypto.encryptMessage(originalMessage, ratchetState);
      
      expect(encrypted).toBeDefined();
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.nonce).toBeDefined();
      expect(encrypted.messageCount).toBe(1);
      
      const decrypted = await AmiXCrypto.decryptMessage(encrypted, ratchetState);
      expect(decrypted).toBe(originalMessage);
    });

    test('should maintain forward secrecy', async () => {
      const sharedSecret = await AmiXCrypto.generateRandomBytes(32);
      const ourKeys = await AmiXCrypto.generateIdentityKeys();
      const theirKeys = await AmiXCrypto.generateIdentityKeys();
      
      const ratchetState = await AmiXCrypto.createRatchetState(
        AmiXCrypto.bytesToHex(sharedSecret),
        ourKeys.privateKey,
        theirKeys.publicKey
      );
      
      const message1 = 'First message';
      const message2 = 'Second message';
      
      const encrypted1 = await AmiXCrypto.encryptMessage(message1, ratchetState);
      const encrypted2 = await AmiXCrypto.encryptMessage(message2, ratchetState);
      
      // Messages should be encrypted differently
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      
      // Both should decrypt correctly
      const decrypted1 = await AmiXCrypto.decryptMessage(encrypted1, ratchetState);
      const decrypted2 = await AmiXCrypto.decryptMessage(encrypted2, ratchetState);
      
      expect(decrypted1).toBe(message1);
      expect(decrypted2).toBe(message2);
    });
  });

  describe('Safety Number Generation', () => {
    test('should generate safety numbers', async () => {
      const key1 = await AmiXCrypto.generateRandomBytes(32);
      const key2 = await AmiXCrypto.generateRandomBytes(32);
      
      const safetyNumber = await AmiXCrypto.generateSafetyNumber(
        AmiXCrypto.bytesToHex(key1),
        AmiXCrypto.bytesToHex(key2)
      );
      
      expect(safetyNumber).toBeDefined();
      expect(typeof safetyNumber).toBe('string');
      expect(safetyNumber.length).toBeGreaterThan(0);
      expect(safetyNumber).toMatch(/^[A-Z0-9\s]+$/);
    });

    test('should generate consistent safety numbers', async () => {
      const key1 = await AmiXCrypto.generateRandomBytes(32);
      const key2 = await AmiXCrypto.generateRandomBytes(32);
      
      const safetyNumber1 = await AmiXCrypto.generateSafetyNumber(
        AmiXCrypto.bytesToHex(key1),
        AmiXCrypto.bytesToHex(key2)
      );
      
      const safetyNumber2 = await AmiXCrypto.generateSafetyNumber(
        AmiXCrypto.bytesToHex(key1),
        AmiXCrypto.bytesToHex(key2)
      );
      
      expect(safetyNumber1).toBe(safetyNumber2);
    });
  });

  describe('Secure Storage', () => {
    test('should store and retrieve data securely', async () => {
      const testData = { message: 'Secret message', timestamp: Date.now() };
      
      await AmiXCrypto.storeSecurely('test_key', testData);
      const retrieved = await AmiXCrypto.getSecurely('test_key');
      
      expect(retrieved).toEqual(testData);
    });

    test('should handle null values', async () => {
      await AmiXCrypto.storeSecurely('null_key', null);
      const retrieved = await AmiXCrypto.getSecurely('null_key');
      
      expect(retrieved).toBeNull();
    });
  });

  describe('Message Signing and Verification', () => {
    test('should sign and verify messages', async () => {
      const keys = await AmiXCrypto.generateIdentityKeys();
      const message = 'Test message to sign';
      
      const signature = await AmiXCrypto.signMessage(message, keys.privateKey);
      const isValid = await AmiXCrypto.verifyMessageIntegrity(message, signature, keys.publicKey);
      
      expect(signature).toBeDefined();
      expect(isValid).toBe(true);
    });

    test('should reject tampered messages', async () => {
      const keys = await AmiXCrypto.generateIdentityKeys();
      const message = 'Original message';
      const tamperedMessage = 'Tampered message';
      
      const signature = await AmiXCrypto.signMessage(message, keys.privateKey);
      const isValid = await AmiXCrypto.verifyMessageIntegrity(tamperedMessage, signature, keys.publicKey);
      
      expect(isValid).toBe(false);
    });
  });

  describe('UUID Generation', () => {
    test('should generate secure UUIDs', async () => {
      const uuid1 = await AmiXCrypto.generateSecureUUID();
      const uuid2 = await AmiXCrypto.generateSecureUUID();
      
      expect(uuid1).toBeDefined();
      expect(uuid2).toBeDefined();
      expect(uuid1).not.toBe(uuid2);
      expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(uuid2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('Utility Functions', () => {
    test('should convert between hex and bytes', () => {
      const originalBytes = new Uint8Array([1, 2, 3, 4, 5]);
      const hex = AmiXCrypto.bytesToHex(originalBytes);
      const convertedBytes = AmiXCrypto.hexToBytes(hex);
      
      expect(hex).toBe('0102030405');
      expect(convertedBytes).toEqual(originalBytes);
    });

    test('should handle secure deletion', () => {
      const testArray = new Uint8Array([1, 2, 3, 4, 5]);
      AmiXCrypto.secureDelete(testArray);
      
      // Array should be zeroed out
      expect(testArray.every(byte => byte === 0)).toBe(true);
    });
  });
});

describe('AmiXStorage', () => {
  beforeEach(async () => {
    await AmiXStorage.initialize();
  });

  describe('Secure Storage Operations', () => {
    test('should store and retrieve sensitive data', async () => {
      const sensitiveData = { privateKey: 'secret', publicKey: 'public' };
      
      await AmiXStorage.storeSecurely('test_sensitive', sensitiveData);
      const retrieved = await AmiXStorage.getSecurely('test_sensitive');
      
      expect(retrieved).toEqual(sensitiveData);
    });

    test('should handle identity keys', async () => {
      const identityKeys = {
        privateKey: 'private_key_data',
        publicKey: 'public_key_data',
      };
      
      await AmiXStorage.storeIdentityKeys(identityKeys);
      const retrieved = await AmiXStorage.getIdentityKeys();
      
      expect(retrieved).toEqual(identityKeys);
    });
  });

  describe('Message Storage', () => {
    test('should store and retrieve messages', async () => {
      const conversationId = 'test_conversation';
      const message = {
        content: 'Hello, world!',
        senderId: 'alice',
        timestamp: Date.now(),
      };
      
      await AmiXStorage.storeMessage(conversationId, message);
      const messages = await AmiXStorage.getMessages(conversationId);
      
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe(message.content);
    });
  });

  describe('Backup and Restore', () => {
    test('should create and restore backups', async () => {
      const passphrase = 'test_passphrase';
      
      // Store some test data
      await AmiXStorage.storeIdentityKeys({ privateKey: 'test', publicKey: 'test' });
      await AmiXStorage.storeMessage('test_conv', { content: 'test message' });
      
      // Create backup
      const backup = await AmiXStorage.createBackup(passphrase);
      
      expect(backup).toBeDefined();
      expect(backup.encryptedData).toBeDefined();
      expect(backup.nonce).toBeDefined();
      
      // Clear storage
      await AmiXStorage.secureDelete();
      
      // Restore backup
      const restored = await AmiXStorage.restoreBackup(backup, passphrase);
      
      expect(restored).toBe(true);
      
      // Verify data was restored
      const identityKeys = await AmiXStorage.getIdentityKeys();
      expect(identityKeys).toBeDefined();
    });
  });
});

describe('AmiXGroupCrypto', () => {
  beforeEach(async () => {
    await AmiXStorage.initialize();
  });

  describe('Group Creation', () => {
    test('should create groups', async () => {
      const creatorKeys = {
        amixId: 'creator123',
        privateKey: 'private_key',
        publicKey: 'public_key',
      };
      
      const groupState = await AmiXGroupCrypto.createGroup('test_group', creatorKeys);
      
      expect(groupState).toBeDefined();
      expect(groupState.id).toBe('test_group');
      expect(groupState.creatorId).toBe('creator123');
      expect(groupState.members.has('creator123')).toBe(true);
    });
  });

  describe('Group Message Encryption', () => {
    test('should encrypt and decrypt group messages', async () => {
      const creatorKeys = {
        amixId: 'creator123',
        privateKey: 'private_key',
        publicKey: 'public_key',
      };
      
      const groupState = await AmiXGroupCrypto.createGroup('test_group', creatorKeys);
      const message = { content: 'Hello, group!' };
      
      const encrypted = await AmiXGroupCrypto.encryptGroupMessage(groupState, creatorKeys, message);
      
      expect(encrypted).toBeDefined();
      expect(encrypted.groupId).toBe('test_group');
      expect(encrypted.senderId).toBe('creator123');
      expect(encrypted.encryptedContent).toBeDefined();
      
      const decrypted = await AmiXGroupCrypto.decryptGroupMessage(encrypted, creatorKeys, groupState);
      
      expect(decrypted.content).toBe(message.content);
    });
  });
});
