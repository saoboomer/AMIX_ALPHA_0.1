import * as AmiXCrypto from './crypto';

const METADATA_PROTECTION = {
  MIN_PADDING: 64,    // 64 bytes minimum padding
  MAX_PADDING: 1024,  // 1KB maximum padding
  VERSION: 1,         // Protocol version
};

export class MetadataProtection {
  // Add protection to metadata
  static async protect(metadata) {
    try {
      // Generate random padding
      const paddingSize = METADATA_PROTECTION.MIN_PADDING + 
        Math.floor(Math.random() * (METADATA_PROTECTION.MAX_PADDING - METADATA_PROTECTION.MIN_PADDING));
      
      const padding = await AmiXCrypto.generateRandomBytes(paddingSize);
      
      // Create protected metadata
      const protectedMetadata = {
        v: METADATA_PROTECTION.VERSION,
        ts: Date.now(),
        data: metadata,
        padding: AmiXCrypto.bytesToBase64(padding)
      };
      
      return protectedMetadata;
    } catch (error) {
      console.error('Metadata protection failed:', error);
      throw new Error('Failed to protect metadata');
    }
  }

  // Remove protection from metadata
  static async unprotect(protectedMetadata) {
    try {
      if (!protectedMetadata || protectedMetadata.v !== METADATA_PROTECTION.VERSION) {
        throw new Error('Invalid metadata format');
      }
      
      // Return only the actual data
      return protectedMetadata.data;
    } catch (error) {
      console.error('Metadata unprotection failed:', error);
      throw new Error('Failed to unprotect metadata');
    }
  }
  
  // Obfuscate timing information
  static async constantTimeCompare(a, b) {
    const aBuf = new TextEncoder().encode(String(a));
    const bBuf = new TextEncoder().encode(String(b));
    
    if (aBuf.length !== bBuf.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < aBuf.length; i++) {
      result |= aBuf[i] ^ bBuf[i];
    }
    
    return result === 0;
  }
}

export default MetadataProtection;
