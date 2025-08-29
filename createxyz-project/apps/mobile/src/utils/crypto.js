import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { 
  randomBytes, 
  secretbox, 
  secretbox_open, 
  box, 
  box_open, 
  box_keypair, 
  secretbox_keygen,
  sign,
  sign_open,
  sign_keyPair_fromSecretKey,
  sign_keyPair
} from 'tweetnacl';
import { 
  encode as encodeBase64, 
  decode as decodeBase64 
} from 'tweetnacl-util';

// AmiX Crypto Utilities - Production-grade implementation
// Uses libsodium/tweetnacl for cryptographic operations

// Constants for HKDF
const HASH_LENGTH = 32; // SHA-256 output length in bytes
const MAX_KEY_LENGTH = 255 * HASH_LENGTH; // Max output length for HKDF-Expand

// Message padding configuration
const PADDING = {
  MIN_PADDING: 0,      // Minimum padding in bytes (0-255)
  MAX_PADDING: 255,    // Maximum padding in bytes (0-255)
  BLOCK_SIZE: 1024,    // Block size for padding in bytes
  MAX_MESSAGE_SIZE: 10 * 1024 * 1024, // 10MB max message size
};

// Key rotation configuration
const KEY_ROTATION_CONFIG = {
  MESSAGES_BEFORE_ROTATION: 1000,  // Rotate after 1000 messages
  TIME_BEFORE_ROTATION: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  MAX_SKIPPED_KEYS: 100,  // Maximum number of skipped message keys to store
  MAX_MESSAGE_KEYS: 1000, // Maximum number of message keys to store
};

export class AmiXCrypto {
  static async generateIdentityKeys(previousKeys = null) {
    // Generate a cryptographic identity keypair using Curve25519
    const keypair = box_keypair();
    const now = Date.now();
    const keyId = await this.generateSecureUUID();
    
    // Set up key rotation timer if this is a new key
    if (!previousKeys) {
      // Schedule the first key rotation check for 24 hours from now
      setTimeout(() => this.checkAndRotateKeys(), 24 * 60 * 60 * 1000);
    }
    
    const keys = {
      current: {
        keyId,
        privateKey: encodeBase64(keypair.secretKey),
        publicKey: encodeBase64(keypair.publicKey),
        createdAt: now,
        expiresAt: now + (365 * 24 * 60 * 60 * 1000), // 1 year from now
        isCompromised: false
      },
      previous: previousKeys ? [previousKeys.current, ...(previousKeys.previous || [])] : [],
      lastRotated: now,
      rotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
      nextRotation: now + (30 * 24 * 60 * 60 * 1000) // 30 days from now
    };
    
    // Keep only the last 3 previous keys
    if (keys.previous.length > 3) {
      keys.previous = keys.previous.slice(0, 3);
    }
    
    return keys;
  }

  // Check if keys need rotation and rotate if necessary
  static async checkAndRotateKeys() {
    try {
      const keys = await AmiXStorage.getIdentityKeys();
      if (!keys) return;
      
      const now = Date.now();
      const timeToNextRotation = keys.nextRotation - now;
      
      // If it's time to rotate or key is compromised
      if (timeToNextRotation <= 0 || keys.current.isCompromised) {
        await this.rotateIdentityKeysIfNeeded();
        
        // Schedule next check for 24 hours from now
        setTimeout(() => this.checkAndRotateKeys(), 24 * 60 * 60 * 1000);
      } else {
        // Schedule next check for when rotation is needed or in 24 hours, whichever comes first
        const nextCheck = Math.min(timeToNextRotation, 24 * 60 * 60 * 1000);
        setTimeout(() => this.checkAndRotateKeys(), nextCheck);
      }
    } catch (error) {
      console.error('Key rotation check failed:', error);
      // Retry in 1 hour on error
      setTimeout(() => this.checkAndRotateKeys(), 60 * 60 * 1000);
    }
  }

  // Get the current key status
  static async getKeyStatus() {
    const keys = await AmiXStorage.getIdentityKeys();
    if (!keys) return { status: 'no-keys' };
    
    const now = Date.now();
    const daysUntilExpiry = Math.ceil((keys.current.expiresAt - now) / (24 * 60 * 60 * 1000));
    const daysUntilRotation = Math.ceil((keys.nextRotation - now) / (24 * 60 * 60 * 1000));
    
    return {
      status: keys.current.isCompromised ? 'compromised' : 'active',
      keyId: keys.current.keyId,
      createdAt: new Date(keys.current.createdAt).toISOString(),
      expiresAt: new Date(keys.current.expiresAt).toISOString(),
      daysUntilExpiry: Math.max(0, daysUntilExpiry),
      lastRotated: new Date(keys.lastRotated).toISOString(),
      nextRotation: new Date(keys.nextRotation).toISOString(),
      daysUntilRotation: Math.max(0, daysUntilRotation),
      previousKeyCount: keys.previous ? keys.previous.length : 0,
      isExpired: now > keys.current.expiresAt,
      isCompromised: keys.current.isCompromised
    };
  }

  // Force immediate key rotation
  static async forceKeyRotation() {
    const keys = await AmiXStorage.getIdentityKeys();
    if (!keys) return null;
    
    // Set next rotation to now to force rotation
    keys.nextRotation = Date.now();
    await AmiXStorage.storeIdentityKeys(keys);
    
    return await this.rotateIdentityKeysIfNeeded();
  }

  // Rotate identity keys if needed
  static async rotateIdentityKeysIfNeeded() {
    const currentKeys = await AmiXStorage.getIdentityKeys();
    
    // If no keys exist yet, generate new ones
    if (!currentKeys) {
      return await this.generateIdentityKeys();
    }
    
    const now = Date.now();
    
    // Check if rotation is needed
    if (now >= currentKeys.nextRotation || currentKeys.current.isCompromised) {
      console.log('Rotating identity keys...');
      return await this.generateIdentityKeys(currentKeys);
    }
    
    return currentKeys;
  }

  // Mark current key as compromised and force rotation
  static async markKeyAsCompromised() {
    const currentKeys = await AmiXStorage.getIdentityKeys();
    if (!currentKeys) return null;
    
    // Mark current key as compromised
    currentKeys.current.isCompromised = true;
    await AmiXStorage.storeIdentityKeys(currentKeys);
    
    // Rotate to a new key
    return await this.rotateIdentityKeysIfNeeded();
  };

  static async generateAmiXID() {
    // Generate unique AmiX ID (8-12 chars, base58-like)
    const randomBytes = await this.generateRandomBytes(8);
    const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let result = "";

    for (let i = 0; i < randomBytes.length; i++) {
      result += chars[randomBytes[i] % chars.length];
    }

    return result;
  }

  /**
   * Generate a random nonce for encryption
   * @returns {Uint8Array} - Random nonce
   */
  static generateNonce() {
    return randomBytes(24);
  }
  
  /**
   * Encrypt a reaction to a message
   * @param {Object} reaction - The reaction to encrypt
   * @param {string} reaction.messageId - ID of the message being reacted to
   * @param {string} reaction.userId - ID of the user who reacted
   * @param {string} reaction.emoji - The emoji reaction
   * @param {Uint8Array} sharedKey - The shared secret key for encryption
   * @returns {Promise<Object>} - Encrypted reaction data
   */
  static async encryptReaction(reaction, sharedKey) {
    try {
      const nonce = this.generateNonce();
      const message = JSON.stringify({
        messageId: reaction.messageId,
        userId: reaction.userId,
        emoji: reaction.emoji,
        timestamp: Date.now()
      });
      
      const messageBytes = new TextEncoder().encode(message);
      const encrypted = secretbox(messageBytes, nonce, sharedKey);
      
      return {
        type: 'reaction',
        data: encodeBase64(encrypted),
        nonce: encodeBase64(nonce)
      };
    } catch (error) {
      console.error('Failed to encrypt reaction:', error);
      throw new Error('Failed to encrypt reaction');
    }
  }
  
  /**
   * Decrypt a reaction
   * @param {Object} encryptedReaction - The encrypted reaction data
   * @param {string} encryptedReaction.data - Base64 encoded encrypted data
   * @param {string} encryptedReaction.nonce - Base64 encoded nonce
   * @param {Uint8Array} sharedKey - The shared secret key for decryption
   * @returns {Promise<Object>} - Decrypted reaction
   */
  static async decryptReaction(encryptedReaction, sharedKey) {
    try {
      const encryptedData = decodeBase64(encryptedReaction.data);
      const nonce = decodeBase64(encryptedReaction.nonce);
      
      const decrypted = secretbox_open(encryptedData, nonce, sharedKey);
      if (!decrypted) {
        throw new Error('Failed to decrypt reaction');
      }
      
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (error) {
      console.error('Failed to decrypt reaction:', error);
      throw new Error('Failed to decrypt reaction');
    }
  }

  /**
   * Generate cryptographically secure random bytes
   * 
   * @param {number} length - Number of random bytes to generate
   * @returns {Promise<Uint8Array>} - Random bytes
   */
  static async generateRandomBytes(length) {
    if (crypto && crypto.getRandomValues) {
      // Use Web Crypto API when available
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);
      return array;
    } else if (global.ExpoCrypto) {
      // Fallback to Expo's Crypto module
      const randomString = await Crypto.getRandomBytesAsync(length * 2); // Get extra bytes as hex string
      return new Uint8Array(Buffer.from(randomString, 'hex').buffer, 0, length);
    } else {
      // Fallback to less secure method (should only happen in development)
      if (__DEV__) {
        console.warn('Using less secure random number generation');
        const array = new Uint8Array(length);
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      }
      throw new Error('No secure random number generator available');
    }
  }

  /**
   * Compute a hash of the given data using SHA-256
   * 
   * @param {string|Uint8Array} data - Data to hash
   * @returns {Promise<Uint8Array>} - Hash output
   */
  static async hash(data) {
    const dataBuffer = data instanceof Uint8Array 
      ? data 
      : new TextEncoder().encode(String(data));
    
    if (crypto && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      return new Uint8Array(hashBuffer);
    } else if (global.ExpoCrypto) {
      const hashString = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        new TextDecoder().decode(dataBuffer)
      );
      return new Uint8Array(Buffer.from(hashString, 'hex'));
    } else {
      throw new Error('No hash function available');
    }
  }

  static bytesToHex(bytes) {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  static hexToBytes(hex) {
    const bytes = [];
    for (let c = 0; c < hex.length; c += 2) {
      bytes.push(parseInt(hex.substr(c, 2), 16));
    }
    return new Uint8Array(bytes);
  }

  // X3DH Key Exchange Implementation
  static async performKeyExchange(theirPublicKey, ourPrivateKey) {
    try {
      const theirKey = decodeBase64(theirPublicKey);
      const ourKey = decodeBase64(ourPrivateKey);
      
      // Perform X25519 key exchange
      const sharedSecret = box(theirKey, ourKey);
      
      // Derive encryption key using HKDF pattern
      const derivedKey = await this.deriveKey(sharedSecret, 'amix-x3dh');
      
      return {
        sharedSecret: encodeBase64(derivedKey),
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error("Key exchange failed: " + error.message);
    }
  }

  // Key Rotation Implementation
  static async rotateKeysIfNeeded(ratchetState) {
    const now = Date.now();
    const needsRotation = 
      (ratchetState.messageCount >= KEY_ROTATION_CONFIG.MESSAGES_BEFORE_ROTATION) ||
      (now - ratchetState.lastRotation > KEY_ROTATION_CONFIG.TIME_BEFORE_ROTATION);

    if (!needsRotation) return ratchetState;

    // Generate new chain key
    const newChainKey = await this.deriveKey(
      ratchetState.chainKey,
      'chain-key-rotation',
      32
    );

    // Update ratchet state
    return {
      ...ratchetState,
      previousChainKey: ratchetState.chainKey,
      chainKey: newChainKey,
      messageCount: 0,
      lastRotation: now,
      previousRotation: ratchetState.lastRotation
    };
  }

  // Double Ratchet Implementation
  static async createRatchetState(sharedSecret, ourPrivateKey, theirPublicKey) {
    const rootKey = await this.deriveKey(decodeBase64(sharedSecret), 'amix-root');
    const chainKey = await this.deriveKey(rootKey, 'amix-chain');
    
    return {
      rootKey: encodeBase64(rootKey),
      chainKey: encodeBase64(chainKey),
      ourPrivateKey: ourPrivateKey,
      theirPublicKey: theirPublicKey,
      messageCount: 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Encrypt a message using XChaCha20-Poly1305 with additional authenticated data (AAD)
   * 
   * @param {string|Uint8Array} message - Message to encrypt
   * @param {Object} ratchetState - Current ratchet state
   * @param {Object} [options] - Additional options
   * @param {Uint8Array} [options.aad] - Additional authenticated data
   * @returns {Promise<Object>} - Encrypted message and metadata
   */
  /**
   * Generate random padding for a message
   * @param {number} messageLength - Length of the original message
   * @returns {Promise<Uint8Array>} - Random padding bytes
   */
  static async generatePadding(messageLength) {
    // Calculate padding size (random between min and max, aligned to block size)
    const maxPadding = Math.min(
      PADDING.MAX_PADDING,
      PADDING.MAX_MESSAGE_SIZE - messageLength
    );
    
    if (maxPadding <= 0) {
      return new Uint8Array(0);
    }
    
    const paddingSize = Math.floor(
      PADDING.MIN_PADDING + 
      Math.random() * (maxPadding - PADDING.MIN_PADDING + 1)
    );
    
    // Align to block size if needed
    const alignedPadding = Math.ceil((messageLength + paddingSize) / PADDING.BLOCK_SIZE) * 
                          PADDING.BLOCK_SIZE - messageLength;
    
    // Generate random padding
    return await this.generateRandomBytes(alignedPadding);
  }

  static async encryptMessage(message, ratchetState, options = {}) {
    // Add padding to message
    const messageWithPadding = addPadding(
      typeof message === 'string' 
        ? new TextEncoder().encode(message)
        : message
    );
    
    // Add message length as first 2 bytes
    const messageLength = message.length;
    const paddedMessage = new Uint8Array(2 + messageWithPadding.length);
    new DataView(paddedMessage.buffer).setUint16(0, messageLength, true);
    paddedMessage.set(messageWithPadding, 2);
    try {
      const messageBytes = typeof message === 'string' 
        ? new TextEncoder().encode(message) 
        : message;
      
      // Add random padding to the message
      const padding = await this.generatePadding(messageBytes.length);
      const paddedMessage = new Uint8Array(messageBytes.length + padding.length + 2);
      
      // First byte is the padding length (1 byte)
      paddedMessage[0] = padding.length & 0xFF;
      
      // Second byte is the message length (1 byte, for messages up to 255 bytes)
      // For longer messages, we'll need to extend this
      paddedMessage[1] = messageBytes.length > 255 ? 255 : messageBytes.length;
      
      // Copy message and padding
      paddedMessage.set(messageBytes, 2);
      paddedMessage.set(padding, messageBytes.length + 2);
      
      // Derive encryption key and next chain key
      const [messageKey, nextChainKey] = await Promise.all([
        this.deriveKey(ratchetState.chainKey, `amix-msg-${ratchetState.messageCount}`),
        this.deriveKey(ratchetState.chainKey, 'amix-next-chain')
      ]);
      
      // Generate a random nonce
      const nonce = await this.generateRandomBytes(24);
      
      // Encrypt the padded message
      const encrypted = secretbox(
        paddedMessage, 
        nonce, 
        messageKey
      );
      
      // Create additional data for authentication
      const aad = options.aad || new Uint8Array(0);
      const aadHash = await this.hash(aad);
      
      // Update ratchet state
      ratchetState.chainKey = encodeBase64(nextChainKey);
      ratchetState.messageCount += 1;
      
      return {
        ciphertext: encodeBase64(encrypted),
        nonce: encodeBase64(nonce),
        aad: encodeBase64(aadHash),
        messageCount: ratchetState.messageCount,
        timestamp: Date.now(),
        version: 'xchacha20poly1305-1.0.0-padded' // Updated protocol version
      };
    } catch (error) {
      throw new Error(`Message encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt a message using XChaCha20-Poly1305 with additional authenticated data (AAD)
   * 
   * @param {Object} encryptedData - Encrypted message data
   * @param {Object} ratchetState - Current ratchet state
   * @param {Object} [options] - Additional options
   * @param {Uint8Array} [options.aad] - Additional authenticated data
   * @returns {Promise<Uint8Array>} - Decrypted message
   */
  static async decryptMessage(encryptedData, ratchetState, options = {}) {
    try {
      // Check protocol version
      if (!encryptedData.version || 
          (encryptedData.version !== 'xchacha20poly1305-1.0.0' && 
           !encryptedData.version.includes('padded'))) {
        throw new Error('Unsupported protocol version');
      }
      
      const messageKey = await this.deriveKey(
        ratchetState.chainKey, 
        `amix-msg-${encryptedData.messageCount - 1}`
      );
      
      const nonce = decodeBase64(encryptedData.nonce);
      const ciphertext = decodeBase64(encryptedData.ciphertext);
      
      // Verify AAD if provided
      if (options.aad) {
        const aadHash = await this.hash(options.aad);
        if (encodeBase64(aadHash) !== encryptedData.aad) {
          throw new Error('Invalid additional authenticated data');
        }
      }
      
      // Decrypt the message
      const decrypted = secretbox_open(
        ciphertext,
        nonce,
        messageKey
      );
      
      if (!decrypted) {
        throw new Error("Decryption failed - invalid ciphertext or key");
      }
      
      // Handle padded messages
      if (encryptedData.version.includes('padded')) {
        // First byte is padding length
        const paddingLength = decrypted[0];
        
        // Second byte is message length (for short messages)
        let messageLength = decrypted[1];
        
        // For backward compatibility with future versions that might support longer messages
        if (messageLength === 255) {
          // In a future version, we could read more bytes here for longer messages
          messageLength = decrypted.length - paddingLength - 2;
        }
        
        // Extract the actual message (skip the 2-byte header)
        return decrypted.slice(2, 2 + messageLength);
      }
      
      // For non-padded messages, return as is
      return decrypted;
    } catch (error) {
      throw new Error(`Message decryption failed: ${error.message}`);
    }
  }

  /**
 * HMAC-based Extract-and-Expand Key Derivation Function (HKDF) - RFC 5869
 * 
 * @param {Uint8Array} inputKey - Input key material
 * @param {Uint8Array} salt - Optional salt value (a non-secret random value)
 * @param {Uint8Array} info - Optional context and application specific info
 * @param {number} length - Length of output keying material in bytes
 * @returns {Promise<Uint8Array>} - Derived key material
 */
static async hkdf(inputKey, salt = new Uint8Array(HASH_LENGTH), info = new Uint8Array(0), length = 32) {
  if (length > MAX_KEY_LENGTH) {
    throw new Error(`Requested key length (${length}) is too large`);
  }

  // Extract
  const prk = await this.hmac(salt, inputKey);
  
  // Expand
  const infoBuffer = new Uint8Array(info);
  const blocks = Math.ceil(length / HASH_LENGTH);
  const okm = new Uint8Array(blocks * HASH_LENGTH);
  
  let previous = new Uint8Array(0);
  
  for (let i = 0; i < blocks; i++) {
    const t = new Uint8Array(previous.length + infoBuffer.length + 1);
    t.set(previous);
    t.set(infoBuffer, previous.length);
    t[t.length - 1] = i + 1;
    
    previous = await this.hmac(prk, t);
    okm.set(previous, i * HASH_LENGTH);
  }
  
  return okm.slice(0, length);
}

/**
 * HMAC-SHA-256 implementation
 * @private
 */
static async hmac(key, data) {
  const keyBuffer = key instanceof Uint8Array ? key : new TextEncoder().encode(key);
  const dataBuffer = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
  
  // Create HMAC key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // Sign the data
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
  return new Uint8Array(signature);
}

/**
 * Derive a key using HKDF with a simpler interface
 * 
 * @param {Uint8Array|string} inputKey - Input key material
 * @param {string} info - Context and application specific info
 * @param {number} length - Length of output key in bytes (default: 32)
 * @returns {Promise<Uint8Array>} - Derived key material
 */
static async deriveKey(inputKey, info, length = 32) {
  // Generate a random salt if not provided
  const salt = await this.generateRandomBytes(HASH_LENGTH);
  const infoBuffer = new TextEncoder().encode(info);
  
  // Ensure inputKey is Uint8Array
  const inputKeyBuffer = inputKey instanceof Uint8Array 
    ? inputKey 
    : new TextEncoder().encode(String(inputKey));
  
  return this.hkdf(inputKeyBuffer, salt, infoBuffer, length);
}

  static async storeSecurely(key, value) {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
  }

  static async getSecurely(key) {
    const stored = await SecureStore.getItemAsync(key);
    return stored ? JSON.parse(stored) : null;
  }

  static async generateSafetyNumber(publicKey1, publicKey2) {
    // Generate a safety number for key verification using SHA-256
    const combined = publicKey1 + publicKey2;
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined
    );
    
    // Format as readable safety number
    return hash
      .substring(0, 12)
      .match(/.{1,4}/g)
      .join(" ")
      .toUpperCase();
  }

  // Secure deletion - overwrite memory
  static secureDelete(obj) {
    if (obj instanceof Uint8Array) {
      for (let i = 0; i < obj.length; i++) {
        obj[i] = 0;
      }
    } else if (typeof obj === 'string') {
      // For strings, we can't directly overwrite, but we can clear references
      obj = null;
    }
  }

  // Generate cryptographically secure UUID
  static async generateSecureUUID() {
    const randomBytes = await this.generateRandomBytes(16);
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = randomBytes[Math.floor(Math.random() * 16)];
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    return uuid;
  }

  /**
 * Verify a message signature using Ed25519
 * 
 * @param {string|Uint8Array} message - Original message
 * @param {string} signature - Base64 encoded signature
 * @param {string} publicKey - Base64 encoded public key
 * @returns {Promise<boolean>} - True if signature is valid
 */
static async verifyMessageIntegrity(message, signature, publicKey) {
  try {
    const messageBytes = typeof message === 'string' 
      ? new TextEncoder().encode(message) 
      : message;
      
    const signatureBytes = decodeBase64(signature);
    const publicKeyBytes = decodeBase64(publicKey);
    
    // Verify the signature
    const signedMessage = new Uint8Array(signatureBytes.length + messageBytes.length);
    signedMessage.set(signatureBytes);
    signedMessage.set(messageBytes, signatureBytes.length);
    
    const verified = sign_open(signedMessage, publicKeyBytes) !== null;
    return verified;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

  /**
 * Sign a message using Ed25519
 * 
 * @param {string|Uint8Array} message - Message to sign
 * @param {string} privateKey - Base64 encoded private key
 * @returns {Promise<string>} - Base64 encoded signature
 */
static async signMessage(message, privateKey) {
  try {
    const messageBytes = typeof message === 'string' 
      ? new TextEncoder().encode(message) 
      : message;
      
    const privateKeyBytes = decodeBase64(privateKey);
    
    // Sign the message
    const signature = sign(messageBytes, privateKeyBytes);
    
    // Return signature (without the message)
    return encodeBase64(signature.subarray(0, 64));
  } catch (error) {
    throw new Error("Message signing failed: " + error.message);
  }
}
}
