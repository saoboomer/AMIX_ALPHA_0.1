import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as AmiXCrypto from '../utils/crypto';
import MetadataProtection from '../utils/metadataProtection';
import SecurityLogger from '../utils/securityLogger';

class ChatMessage extends React.Component {
  state = {
    decryptedContent: '',
    isDecrypting: true,
    error: null,
    metadata: {}
  };

  async componentDidMount() {
    await this.decryptMessage();
  }

  async decryptMessage() {
    const { message, sessionKeys } = this.props;
    
    try {
      // Check if message needs decryption
      if (message.encrypted) {
        // Decrypt the message content
        const decrypted = await AmiXCrypto.decryptMessage(
          message.content,
          sessionKeys,
          { keyId: message.keyId }
        );
        
        // Unprotect metadata if present
        let metadata = {};
        if (message.metadata) {
          try {
            metadata = await MetadataProtection.unprotect(message.metadata);
          } catch (error) {
            console.warn('Failed to unprotect metadata:', error);
            await SecurityLogger.logEvent(
              SecurityLogger.EVENTS.METADATA_ERROR,
              { messageId: message.id, error: error.message }
            );
          }
        }
        
        this.setState({
          decryptedContent: decrypted,
          isDecrypting: false,
          metadata
        });
      } else {
        this.setState({
          decryptedContent: message.content,
          isDecrypting: false
        });
      }
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      await SecurityLogger.logEvent(
        SecurityLogger.EVENTS.DECRYPTION_ERROR,
        { messageId: message.id, error: error.message }
      );
      
      this.setState({
        error: 'Unable to decrypt message',
        isDecrypting: false
      });
    }
  }

  render() {
    const { message } = this.props;
    const { decryptedContent, isDecrypting, error, metadata } = this.state;

    if (isDecrypting) {
      return (
        <View style={styles.container}>
          <Text>Decrypting...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={[styles.container, styles.errorContainer]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    return (
      <View style={[
        styles.container,
        message.isOutgoing ? styles.outgoing : styles.incoming
      ]}>
        <View style={styles.messageBubble}>
          <Text style={styles.messageText}>{decryptedContent}</Text>
          {metadata.timestamp && (
            <Text style={styles.timestamp}>
              {new Date(metadata.timestamp).toLocaleTimeString()}
            </Text>
          )}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  outgoing: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  incoming: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#e1f5fe',
  },
  messageText: {
    fontSize: 16,
    color: '#000',
  },
  timestamp: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'right',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 8,
    borderRadius: 4,
  },
  errorText: {
    color: '#c62828',
  },
});

export default ChatMessage;
