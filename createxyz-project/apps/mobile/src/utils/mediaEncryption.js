import { AmiXCrypto } from './crypto';
import { AmiXStorage } from './storage';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';

// AmiX Media Encryption - Production-grade implementation
// Handles file encryption, thumbnail generation, and streaming encryption

export class AmiXMediaEncryption {
  static CHUNK_SIZE = 64 * 1024; // 64KB chunks for streaming
  static MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit
  static SUPPORTED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];
  static SUPPORTED_VIDEO_FORMATS = ['mp4', 'webm', 'mov'];
  static SUPPORTED_AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'm4a'];

  // File encryption with per-file keys
  static async encryptFile(fileUri, recipientKeys, options = {}) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      if (fileInfo.size > this.MAX_FILE_SIZE) {
        throw new Error('File too large');
      }

      // Generate per-file encryption key
      const fileKey = await AmiXCrypto.generateRandomBytes(32);
      const fileId = await AmiXCrypto.generateSecureUUID();
      
      // Read file data
      const fileData = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to bytes
      const fileBytes = this.base64ToBytes(fileData);
      
      // Generate thumbnail if it's an image
      let thumbnail = null;
      if (this.isImageFile(fileUri)) {
        thumbnail = await this.generateThumbnail(fileUri, options.thumbnailSize || 200);
      }

      // Encrypt file data
      const encryptedFile = await this.encryptFileData(fileBytes, fileKey);
      
      // Encrypt thumbnail if exists
      let encryptedThumbnail = null;
      if (thumbnail) {
        encryptedThumbnail = await this.encryptFileData(thumbnail, fileKey);
      }

      // Encrypt file key for recipient
      const encryptedFileKey = await this.encryptFileKeyForRecipient(fileKey, recipientKeys);

      // Create file metadata
      const metadata = {
        fileId,
        originalName: this.getFileName(fileUri),
        mimeType: this.getMimeType(fileUri),
        size: fileInfo.size,
        encryptedSize: encryptedFile.length,
        hasThumbnail: !!thumbnail,
        thumbnailSize: thumbnail ? thumbnail.length : 0,
        createdAt: Date.now(),
        expiresAt: options.expiresAt || Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days default
      };

      // Encrypt metadata
      const encryptedMetadata = await this.encryptMetadata(metadata, fileKey);

      return {
        fileId,
        encryptedData: encryptedFile,
        encryptedThumbnail,
        encryptedMetadata,
        encryptedFileKey,
        originalSize: fileInfo.size,
        encryptedSize: encryptedFile.length,
      };
    } catch (error) {
      throw new Error(`File encryption failed: ${error.message}`);
    }
  }

  // Decrypt file with recipient's private key
  static async decryptFile(encryptedFile, recipientKeys) {
    try {
      const { encryptedData, encryptedThumbnail, encryptedMetadata, encryptedFileKey } = encryptedFile;

      // Decrypt file key
      const fileKey = await this.decryptFileKey(encryptedFileKey, recipientKeys);

      // Decrypt metadata
      const metadata = await this.decryptMetadata(encryptedMetadata, fileKey);

      // Decrypt file data
      const decryptedData = await this.decryptFileData(encryptedData, fileKey);

      // Decrypt thumbnail if exists
      let thumbnail = null;
      if (encryptedThumbnail) {
        thumbnail = await this.decryptFileData(encryptedThumbnail, fileKey);
      }

      return {
        data: decryptedData,
        thumbnail,
        metadata,
      };
    } catch (error) {
      throw new Error(`File decryption failed: ${error.message}`);
    }
  }

  // Streaming encryption for large files
  static async createEncryptedStream(fileUri, recipientKeys, onProgress) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      const fileKey = await AmiXCrypto.generateRandomBytes(32);
      const fileId = await AmiXCrypto.generateSecureUUID();

      // Create temporary directory for encrypted chunks
      const tempDir = `${FileSystem.cacheDirectory}amix_encrypted_${fileId}/`;
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

      const chunks = [];
      let offset = 0;
      let chunkIndex = 0;

      while (offset < fileInfo.size) {
        const chunkSize = Math.min(this.CHUNK_SIZE, fileInfo.size - offset);
        
        // Read chunk
        const chunk = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
          length: chunkSize,
          position: offset,
        });

        // Encrypt chunk
        const encryptedChunk = await this.encryptFileData(this.base64ToBytes(chunk), fileKey);
        
        // Save encrypted chunk
        const chunkPath = `${tempDir}chunk_${chunkIndex}.enc`;
        await FileSystem.writeAsStringAsync(chunkPath, this.bytesToBase64(encryptedChunk), {
          encoding: FileSystem.EncodingType.Base64,
        });

        chunks.push({
          index: chunkIndex,
          path: chunkPath,
          size: encryptedChunk.length,
        });

        offset += chunkSize;
        chunkIndex++;

        // Report progress
        if (onProgress) {
          onProgress(offset / fileInfo.size);
        }
      }

      // Encrypt file key for recipient
      const encryptedFileKey = await this.encryptFileKeyForRecipient(fileKey, recipientKeys);

      return {
        fileId,
        chunks,
        encryptedFileKey,
        totalChunks: chunks.length,
        originalSize: fileInfo.size,
        tempDir,
      };
    } catch (error) {
      throw new Error(`Streaming encryption failed: ${error.message}`);
    }
  }

  // Streaming decryption
  static async decryptStream(encryptedStream, recipientKeys, outputPath, onProgress) {
    try {
      const { chunks, encryptedFileKey, tempDir } = encryptedStream;

      // Decrypt file key
      const fileKey = await this.decryptFileKey(encryptedFileKey, recipientKeys);

      // Create output file
      await FileSystem.writeAsStringAsync(outputPath, '', { encoding: FileSystem.EncodingType.UTF8 });

      let totalProcessed = 0;
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);

      for (const chunk of chunks) {
        // Read encrypted chunk
        const encryptedChunkData = await FileSystem.readAsStringAsync(chunk.path, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Decrypt chunk
        const decryptedChunk = await this.decryptFileData(
          this.base64ToBytes(encryptedChunkData),
          fileKey
        );

        // Append to output file
        await FileSystem.writeAsStringAsync(outputPath, this.bytesToBase64(decryptedChunk), {
          encoding: FileSystem.EncodingType.Base64,
          append: true,
        });

        totalProcessed += chunk.size;

        // Report progress
        if (onProgress) {
          onProgress(totalProcessed / totalSize);
        }
      }

      // Clean up temporary files
      await this.cleanupTempFiles(tempDir);

      return outputPath;
    } catch (error) {
      throw new Error(`Streaming decryption failed: ${error.message}`);
    }
  }

  // Thumbnail generation and encryption
  static async generateThumbnail(fileUri, maxSize = 200) {
    try {
      if (!this.isImageFile(fileUri)) {
        throw new Error('File is not an image');
      }

      const thumbnail = await ImageManipulator.manipulateAsync(
        fileUri,
        [{ resize: { width: maxSize, height: maxSize } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // Read thumbnail data
      const thumbnailData = await FileSystem.readAsStringAsync(thumbnail.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return this.base64ToBytes(thumbnailData);
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      return null;
    }
  }

  // Video call streaming encryption
  static async createVideoStreamEncryption(recipientKeys) {
    try {
      const streamKey = await AmiXCrypto.generateRandomBytes(32);
      const streamId = await AmiXCrypto.generateSecureUUID();

      // Encrypt stream key for recipient
      const encryptedStreamKey = await this.encryptFileKeyForRecipient(streamKey, recipientKeys);

      return {
        streamId,
        streamKey,
        encryptedStreamKey,
        createdAt: Date.now(),
      };
    } catch (error) {
      throw new Error(`Video stream encryption setup failed: ${error.message}`);
    }
  }

  // Encrypt video/audio frame
  static async encryptFrame(frameData, streamKey) {
    try {
      return await this.encryptFileData(frameData, streamKey);
    } catch (error) {
      throw new Error(`Frame encryption failed: ${error.message}`);
    }
  }

  // Decrypt video/audio frame
  static async decryptFrame(encryptedFrame, streamKey) {
    try {
      return await this.decryptFileData(encryptedFrame, streamKey);
    } catch (error) {
      throw new Error(`Frame decryption failed: ${error.message}`);
    }
  }

  // File key management
  static async encryptFileKeyForRecipient(fileKey, recipientKeys) {
    try {
      // Use recipient's public key to encrypt the file key
      const encryptedKey = await AmiXCrypto.encryptMessage(
        AmiXCrypto.bytesToHex(fileKey),
        { chainKey: recipientKeys.publicKey }
      );

      return encryptedKey.ciphertext;
    } catch (error) {
      throw new Error(`File key encryption failed: ${error.message}`);
    }
  }

  static async decryptFileKey(encryptedFileKey, recipientKeys) {
    try {
      const decryptedKey = await AmiXCrypto.decryptMessage(
        { ciphertext: encryptedFileKey, nonce: '' },
        { chainKey: recipientKeys.privateKey }
      );

      return AmiXCrypto.hexToBytes(decryptedKey);
    } catch (error) {
      throw new Error(`File key decryption failed: ${error.message}`);
    }
  }

  // File data encryption/decryption
  static async encryptFileData(data, key) {
    try {
      const nonce = await AmiXCrypto.generateRandomBytes(24);
      const encrypted = await AmiXCrypto.encryptMessage(
        this.bytesToBase64(data),
        { chainKey: AmiXCrypto.bytesToHex(key) }
      );

      // Combine nonce and encrypted data
      const result = new Uint8Array(nonce.length + encrypted.ciphertext.length);
      result.set(nonce);
      result.set(this.base64ToBytes(encrypted.ciphertext), nonce.length);

      return result;
    } catch (error) {
      throw new Error(`File data encryption failed: ${error.message}`);
    }
  }

  static async decryptFileData(encryptedData, key) {
    try {
      // Extract nonce and ciphertext
      const nonce = encryptedData.slice(0, 24);
      const ciphertext = encryptedData.slice(24);

      const decrypted = await AmiXCrypto.decryptMessage(
        { ciphertext: this.bytesToBase64(ciphertext), nonce: this.bytesToBase64(nonce) },
        { chainKey: AmiXCrypto.bytesToHex(key) }
      );

      return this.base64ToBytes(decrypted);
    } catch (error) {
      throw new Error(`File data decryption failed: ${error.message}`);
    }
  }

  // Metadata encryption/decryption
  static async encryptMetadata(metadata, key) {
    try {
      const metadataString = JSON.stringify(metadata);
      return await this.encryptFileData(new TextEncoder().encode(metadataString), key);
    } catch (error) {
      throw new Error(`Metadata encryption failed: ${error.message}`);
    }
  }

  static async decryptMetadata(encryptedMetadata, key) {
    try {
      const decryptedData = await this.decryptFileData(encryptedMetadata, key);
      const metadataString = new TextDecoder().decode(decryptedData);
      return JSON.parse(metadataString);
    } catch (error) {
      throw new Error(`Metadata decryption failed: ${error.message}`);
    }
  }

  // File type detection
  static isImageFile(fileUri) {
    const extension = this.getFileExtension(fileUri).toLowerCase();
    return this.SUPPORTED_IMAGE_FORMATS.includes(extension);
  }

  static isVideoFile(fileUri) {
    const extension = this.getFileExtension(fileUri).toLowerCase();
    return this.SUPPORTED_VIDEO_FORMATS.includes(extension);
  }

  static isAudioFile(fileUri) {
    const extension = this.getFileExtension(fileUri).toLowerCase();
    return this.SUPPORTED_AUDIO_FORMATS.includes(extension);
  }

  static getFileExtension(fileUri) {
    return fileUri.split('.').pop() || '';
  }

  static getFileName(fileUri) {
    return fileUri.split('/').pop() || 'unknown';
  }

  static getMimeType(fileUri) {
    const extension = this.getFileExtension(fileUri).toLowerCase();
    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  // Utility functions
  static base64ToBytes(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  static bytesToBase64(bytes) {
    const binaryString = String.fromCharCode.apply(null, bytes);
    return btoa(binaryString);
  }

  static async cleanupTempFiles(tempDir) {
    try {
      await FileSystem.deleteAsync(tempDir, { idempotent: true });
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }

  // File compression before encryption
  static async compressFile(fileUri, quality = 0.8) {
    try {
      if (this.isImageFile(fileUri)) {
        const compressed = await ImageManipulator.manipulateAsync(
          fileUri,
          [],
          {
            compress: quality,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );
        return compressed.uri;
      }
      // For other file types, return original (compression would need additional libraries)
      return fileUri;
    } catch (error) {
      console.error('File compression failed:', error);
      return fileUri;
    }
  }

  // Batch file processing
  static async encryptMultipleFiles(fileUris, recipientKeys, onProgress) {
    try {
      const results = [];
      const total = fileUris.length;

      for (let i = 0; i < fileUris.length; i++) {
        const fileUri = fileUris[i];
        
        try {
          const encrypted = await this.encryptFile(fileUri, recipientKeys);
          results.push({
            originalUri: fileUri,
            encrypted,
            success: true,
          });
        } catch (error) {
          results.push({
            originalUri: fileUri,
            error: error.message,
            success: false,
          });
        }

        if (onProgress) {
          onProgress((i + 1) / total);
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Batch encryption failed: ${error.message}`);
    }
  }

  // File integrity verification
  static async verifyFileIntegrity(encryptedFile, recipientKeys) {
    try {
      const { encryptedMetadata, encryptedFileKey } = encryptedFile;

      // Decrypt file key
      const fileKey = await this.decryptFileKey(encryptedFileKey, recipientKeys);

      // Decrypt metadata
      const metadata = await this.decryptMetadata(encryptedMetadata, fileKey);

      // Verify file hasn't expired
      if (metadata.expiresAt && Date.now() > metadata.expiresAt) {
        throw new Error('File has expired');
      }

      return {
        isValid: true,
        metadata,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
      };
    }
  }
}
