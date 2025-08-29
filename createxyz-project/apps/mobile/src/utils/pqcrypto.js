import { kyber1024 } from 'pqc-kyber';
import * as AmiXCrypto from './crypto';

export class PQCrypto {
  // Generate a new Kyber key pair
  static async generateKeyPair() {
    try {
      const keyPair = await kyber1024.keyPair();
      return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        keyType: 'kyber1024',
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to generate PQ key pair:', error);
      throw new Error('Key generation failed');
    }
  }

  // Encapsulate a shared secret using recipient's public key
  static async encapsulate(publicKey) {
    try {
      const result = await kyber1024.encrypt(publicKey);
      return {
        ciphertext: result.ciphertext,
        sharedSecret: result.sharedSecret
      };
    } catch (error) {
      console.error('Encapsulation failed:', error);
      throw new Error('Encryption failed');
    }
  }

  // Decapsulate a shared secret using private key
  static async decapsulate(ciphertext, privateKey) {
    try {
      return await kyber1024.decrypt(ciphertext, privateKey);
    } catch (error) {
      console.error('Decapsulation failed:', error);
      throw new Error('Decryption failed');
    }
  }

  // Hybrid key exchange: ECDH + Kyber
  static async hybridKeyExchange(theirPublicKey, myPrivateKey) {
    try {
      // Generate ephemeral key pair for this session
      const ephemeralKeyPair = await this.generateKeyPair();
      
      // Perform Kyber KEM
      const { ciphertext, sharedSecret: pqSharedSecret } = await this.encapsulate(theirPublicKey.pqPublicKey);
      
      // Perform ECDH
      const ecdhSecret = await AmiXCrypto.deriveSharedSecret(
        myPrivateKey.ecPrivateKey,
        theirPublicKey.ecPublicKey
      );
      
      // Combine both shared secrets
      const combinedSecret = await AmiXCrypto.hkdf(
        Buffer.concat([
          Buffer.from(pqSharedSecret),
          Buffer.from(ecdhSecret)
        ]),
        'hybrid-key-exchange'
      );

      return {
        sharedSecret: combinedSecret,
        ephemeralPublicKey: ephemeralKeyPair.publicKey,
        ciphertext,
        keyType: 'x25519-kyber1024'
      };
    } catch (error) {
      console.error('Hybrid key exchange failed:', error);
      throw new Error('Key exchange failed');
    }
  }
}

export default PQCrypto;
