const KEY_NAME = 'user-key-pair';

// Export a CryptoKey to a shareable JWK format
export async function exportKey(key) {
  return window.crypto.subtle.exportKey('jwk', key);
}

// Import a JWK back into a CryptoKey
export async function importKey(jwk) {
  return window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    []
  );
}

// Generate a new key pair for the user
export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );

  const publicKeyJwk = await exportKey(keyPair.publicKey);

  return {
    ...keyPair,
    publicKeyJwk,
  };
}

// Encrypt a message with a shared secret
export async function encryptMessage(sharedSecret, message) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedMessage = new TextEncoder().encode(message);

  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    sharedSecret,
    encodedMessage
  );

  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encryptedContent)),
  };
}

// Decrypt a message with a shared secret
export async function decryptMessage(sharedSecret, encrypted) {
  const decryptedContent = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(encrypted.iv),
    },
    sharedSecret,
    new Uint8Array(encrypted.data)
  );

  return new TextDecoder().decode(decryptedContent);
}

// Generate a safety number for key verification
export async function generateSafetyNumber(publicKeyJwk1, publicKeyJwk2) {
  // A simple safety number generation for demonstration.
  // In a real app, use a more robust method like hashing the sorted public keys.
  const combined = JSON.stringify(publicKeyJwk1) + JSON.stringify(publicKeyJwk2);
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(combined));
  const hashArray = Array.from(new Uint8Array(buffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  // Return a short, readable version
  return hashHex.slice(0, 8).toUpperCase();
}

// --- Double Ratchet Implementation for Forward Secrecy ---

// KDF for deriving new keys. Using HMAC-SHA256.
async function kdf(key, data) {
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await window.crypto.subtle.sign('HMAC', keyMaterial, data);
  return new Uint8Array(signature);
}

// Initialize the ratchet state
export async function initializeRatchet(privateKey, theirPublicKeyJwk) {
  const sharedSecret = await deriveSharedSecret(privateKey, theirPublicKeyJwk);
  const rootKey = await window.crypto.subtle.exportKey('raw', sharedSecret);

  // For simplicity, we'll use the same root key as the initial chain key.
  // A real implementation would use a KDF to derive separate root and chain keys.
  return {
    rootKey: new Uint8Array(rootKey),
    sendChain: {
      key: new Uint8Array(rootKey),
      counter: 0,
    },
    receiveChain: {
      key: new Uint8Array(rootKey),
      counter: 0,
    },
  };
}

// Ratchet encryption step
export async function ratchetEncrypt(ratchetState, plaintext) {
  // 1. Derive message key and next chain key
  const sendChainKey = ratchetState.sendChain.key;
  const messageKeyData = await kdf(sendChainKey, new Uint8Array([1])); // Constant for message key
  const nextChainKey = await kdf(sendChainKey, new Uint8Array([2])); // Constant for next chain key

  // 2. Encrypt plaintext
  const messageKey = await window.crypto.subtle.importKey('raw', messageKeyData, { name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const encryptedMessage = await encryptMessage(messageKey, plaintext);

  // 3. Update ratchet state
  const newRatchetState = {
    ...ratchetState,
    sendChain: {
      key: nextChainKey,
      counter: ratchetState.sendChain.counter + 1,
    },
  };

  return { encryptedMessage, newRatchetState };
}

// Ratchet decryption step
export async function ratchetDecrypt(ratchetState, encryptedMessage) {
  // 1. Derive message key from the current receive chain
  const receiveChainKey = ratchetState.receiveChain.key;
  const messageKeyData = await kdf(receiveChainKey, new Uint8Array([1]));
  const nextChainKey = await kdf(receiveChainKey, new Uint8Array([2]));

  // 2. Decrypt ciphertext
  const messageKey = await window.crypto.subtle.importKey('raw', messageKeyData, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
  const plaintext = await decryptMessage(messageKey, encryptedMessage);

  // 3. Update ratchet state
  const newRatchetState = {
    ...ratchetState,
    receiveChain: {
      key: nextChainKey,
      counter: ratchetState.receiveChain.counter + 1,
    },
  };

  return { plaintext, newRatchetState };
}


// Derive a shared secret from our private key and a peer's public key
export async function deriveSharedSecret(privateKey, publicKeyJwk) {
  const publicKey = await importKey(publicKeyJwk);
  return window.crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: publicKey,
    },
    privateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}
