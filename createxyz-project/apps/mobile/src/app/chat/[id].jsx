import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  Modal, 
  Alert, 
  ActivityIndicator, 
  StyleSheet 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

// Utils
import { AmiXStorage } from '../../utils/storage';
import { AmiXCrypto } from '../../utils/crypto';

// Components
import { MessageReactions } from '../../components/MessageReactions';
import { Ionicons } from '@expo/vector-icons';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [contact, setContact] = useState(null);
  const [userKeys, setUserKeys] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [safetyNumber, setSafetyNumber] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [ratchetState, setRatchetState] = useState(null);
  const [showKeyInfo, setShowKeyInfo] = useState(false);
  const [keyStatus, setKeyStatus] = useState(null);
  const [isRotatingKeys, setIsRotatingKeys] = useState(false);
  const scrollViewRef = useRef(null);

  // Load key status
  const loadKeyStatus = async () => {
    try {
      const status = await AmiXCrypto.getKeyStatus();
      setKeyStatus(status);
    } catch (error) {
      console.error('Error loading key status:', error);
    }
  };

  // Initialize key rotation check
  useEffect(() => {
    // Initial check
    AmiXCrypto.checkAndRotateKeys();
    
    // Set up periodic check (every 6 hours)
    const interval = setInterval(() => {
      AmiXCrypto.checkAndRotateKeys();
    }, 6 * 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Load chat data and initialize ratchet state
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load contact and messages
        const contacts = await AmiXStorage.getContacts();
        const loadedContact = contacts[id];
        setContact(loadedContact);
        setIsVerified(loadedContact?.verified || false);

        // Load messages
        const loadedMessages = await AmiXStorage.getMessages(id);
        setMessages(loadedMessages);

        // Load identity keys
        const keys = await AmiXStorage.getIdentityKeys();
        setUserKeys(keys);

        // Initialize or load ratchet state
        if (keys && loadedContact?.publicKey) {
          let state = await AmiXStorage.getRatchetState(id);
          
          if (!state) {
            // Create new ratchet state if it doesn't exist
            state = await AmiXCrypto.createRatchetState(
              loadedContact.sharedSecret || await AmiXCrypto.performKeyExchange(loadedContact.publicKey, keys.privateKey),
              keys.privateKey,
              loadedContact.publicKey
            );
            await AmiXStorage.storeRatchetState(id, state);
          }
          
          setRatchetState(state);
        }
      } catch (error) {
        console.error('Error loading chat data:', error);
        Alert.alert('Error', 'Failed to load chat data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id]);

  const handleVerify = async () => {
    if (userKeys && contact) {
      const num = await AmiXCrypto.generateSafetyNumber(userKeys.publicKey, contact.publicKey);
      setSafetyNumber(num);
      setModalVisible(true);
    }
  };

  const rotateKeys = async () => {
    try {
      setIsRotatingKeys(true);
      await AmiXCrypto.forceKeyRotation();
      const status = await AmiXCrypto.getKeyStatus();
      setKeyStatus(status);
      Alert.alert('Success', 'Encryption keys have been rotated successfully.');
    } catch (error) {
      console.error('Key rotation failed:', error);
      Alert.alert('Error', 'Failed to rotate encryption keys. Please try again.');
    } finally {
      setIsRotatingKeys(false);
    }
  };

  const markAsVerified = async () => {
    if (contact) {
      try {
        await AmiXStorage.updateContact(id, { verified: true });
        setIsVerified(true);
        setModalVisible(false);
        
        // Initialize ratchet state if not already done
        if (userKeys && contact.publicKey && !ratchetState) {
          const state = await AmiXCrypto.createRatchetState(
            contact.sharedSecret || await AmiXCrypto.performKeyExchange(contact.publicKey, userKeys.privateKey),
            userKeys.privateKey,
            contact.publicKey
          );
          await AmiXStorage.storeRatchetState(id, state);
          setRatchetState(state);
        }
      } catch (error) {
        console.error('Error verifying contact:', error);
        Alert.alert('Error', 'Failed to verify contact');
      }
    }
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      if (!ratchetState || !contact) return;
      
      // Create reaction object
      const reaction = {
        messageId,
        userId: userKeys.publicKey,
        emoji,
        timestamp: new Date().toISOString()
      };
      
      // Encrypt the reaction
      const sharedKey = ratchetState.rootKey || ratchetState.chainKey;
      const encryptedReaction = await AmiXCrypto.encryptReaction(reaction, sharedKey);
      
      // In a real app, you would send the encrypted reaction to the peer here
      console.log('Sending reaction:', { messageId, emoji, encryptedReaction });
      
      // Update local storage
      await AmiXStorage.addReaction(messageId, userKeys.publicKey, emoji);
      
      // Update UI
      const updatedMessages = messages.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            hasReactions: true
          };
        }
        return msg;
      });
      
      setMessages(updatedMessages);
      
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  const renderMessageItem = ({ item }) => {
    const isMe = item.sender === 'me';
    
    return (
      <View style={[
        styles.messageBubble,
        isMe ? styles.myMessage : styles.theirMessage
      ]}>
        <Text style={[styles.messageText, isMe && styles.myMessageText]}>
          {item.text}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isMe && (
            <Text style={styles.messageStatus}>
              {item.status === 'sending' ? '🕒' : item.status === 'sent' ? '✓' : '✓✓'}
            </Text>
          )}
        </View>
        
        <MessageReactions
          message={item}
          currentUserId={userKeys?.publicKey}
          onReaction={handleReaction}
        />
      </View>
    );
  };

  const sendMessage = async () => {
    if (!isVerified) {
      Alert.alert("Verification Required", "You must verify this contact before you can send messages.");
      return;
    }
    
    if (!message.trim() || !ratchetState) return;
    
    try {
      // Encrypt the message using the current ratchet state
      const encryptedData = await AmiXCrypto.encryptMessage(message.trim(), ratchetState);
      
      // Update the ratchet state after encryption
      const updatedState = {
        ...ratchetState,
        chainKey: encryptedData.chainKey,
        messageCount: encryptedData.messageCount
      };
      
      // Store updated state
      await AmiXStorage.storeRatchetState(id, updatedState);
      setRatchetState(updatedState);
      
      // Create message object
      const newMessage = {
        id: await AmiXCrypto.generateSecureUUID(),
        text: message.trim(),
        encryptedData,
        sender: 'me',
        timestamp: new Date(),
        status: 'sending',
        type: 'text',
        hasReactions: false
      };
      
      // Update UI with the new message
      setMessages(prev => [...prev, newMessage]);
      setMessage('');
      
      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      // In a real app, you would send the encrypted data to the peer here
      // For now, we'll simulate sending by updating the status after a delay
      setTimeout(() => {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === newMessage.id 
              ? { ...msg, status: 'sent' } 
              : msg
          )
        );
      }, 1000);
      
      // Save message to storage
      await AmiXStorage.storeMessage(id, newMessage);
      
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  // Navigate to test screen
  const navigateToTestScreen = () => {
    router.push('/chat/test');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <StatusBar style="auto" />
      
      {/* Key Management Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showKeyInfo}
        onRequestClose={() => setShowKeyInfo(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Encryption Keys</Text>
              <TouchableOpacity onPress={() => setShowKeyInfo(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {keyStatus ? (
              <ScrollView style={styles.keyStatusContainer}>
                <View style={styles.keyStatusItem}>
                  <Text style={styles.keyStatusLabel}>Status:</Text>
                  <View style={[
                    styles.statusBadge, 
                    keyStatus.status === 'active' ? styles.statusActive : styles.statusWarning
                  ]}>
                    <Text style={styles.statusText}>
                      {keyStatus.status === 'active' ? 'Secure' : 'Attention Needed'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.keyStatusItem}>
                  <Text style={styles.keyStatusLabel}>Key ID:</Text>
                  <Text style={styles.keyStatusValue} selectable>{keyStatus.keyId}</Text>
                </View>
                
                <View style={styles.keyStatusItem}>
                  <Text style={styles.keyStatusLabel}>Created:</Text>
                  <Text style={styles.keyStatusValue}>
                    {new Date(keyStatus.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                
                <View style={styles.keyStatusItem}>
                  <Text style={styles.keyStatusLabel}>Expires:</Text>
                  <Text style={styles.keyStatusValue}>
                    {new Date(keyStatus.expiresAt).toLocaleDateString()} 
                    {keyStatus.daysUntilExpiry > 0 && `(${keyStatus.daysUntilExpiry} days)`}
                  </Text>
                </View>
                
                <View style={styles.keyStatusItem}>
                  <Text style={styles.keyStatusLabel}>Next Rotation:</Text>
                  <Text style={styles.keyStatusValue}>
                    {new Date(keyStatus.nextRotation).toLocaleDateString()}
                    {keyStatus.daysUntilRotation > 0 && ` (in ${keyStatus.daysUntilRotation} days)`}
                  </Text>
                </View>
                
                <View style={styles.keyActions}>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.rotateButton]}
                    onPress={rotateKeys}
                    disabled={isRotatingKeys}
                  >
                    {isRotatingKeys ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.actionButtonText}>
                        Rotate Keys Now
                      </Text>
                    )}
                  </TouchableOpacity>
                  
                  {keyStatus.isCompromised && (
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.emergencyButton]}
                      onPress={() => {
                        Alert.alert(
                          'Emergency Key Reset',
                          'This will generate new encryption keys and re-encrypt all messages. This action cannot be undone.\n\nDo you want to continue?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Reset Keys', 
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  // This would be implemented to handle emergency key reset
                                  Alert.alert('Not Implemented', 'Emergency key reset will be implemented in a future update.');
                                } catch (error) {
                                  console.error('Emergency reset failed:', error);
                                  Alert.alert('Error', 'Failed to reset encryption keys.');
                                }
                              }
                            }
                          ]
                        );
                      }}
                    >
                      <Text style={styles.actionButtonText}>Emergency Reset</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                <View style={styles.keyInfoFooter}>
                  <Ionicons name="lock-closed" size={16} color="#666" />
                  <Text style={styles.keyInfoText}>
                    Your messages are end-to-end encrypted. Key rotation happens automatically every 30 days.
                  </Text>
                </View>
              </ScrollView>
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
              </View>
            )}
          </View>
        </View>
      </Modal>
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          
          {/* Test Button - Only visible in development */}
          {__DEV__ && (
            <TouchableOpacity 
              onPress={navigateToTestScreen} 
              style={styles.testButton}
            >
              <Text style={styles.testButtonText}>Test</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.headerContent}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.contactName}>
              {contact?.name || 'Unknown Contact'}
            </Text>
            <TouchableOpacity 
              onPress={() => setShowKeyInfo(true)}
              style={{ marginLeft: 8, padding: 4 }}
            >
              <Ionicons 
                name={keyStatus?.status === 'active' ? 'shield-checkmark' : 'shield-warning'} 
                size={20} 
                color={keyStatus?.status === 'active' ? '#4CAF50' : '#FFA000'} 
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.contactStatus}>
            {isVerified ? 'Verified' : 'Unverified'}
          </Text>
        </View>

        {!isVerified && contact && (
          <TouchableOpacity onPress={handleVerify} style={styles.verifyButton}>
            <Text style={styles.verifyButtonText}>Verify</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A2C2A" />
          </View>
        ) : messages.map((msg, index) => (
          <View key={msg.id || index} style={styles.messageWrapper}>
            {renderMessageItem({ item: msg })}
          </View>
        ))}
      </ScrollView>

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder={isVerified ? "Type a message..." : "Verify contact to message"}
          placeholderTextColor="#999"
          value={message}
          onChangeText={setMessage}
          onSubmitEditing={sendMessage}
          multiline
          editable={isVerified}
        />
        <TouchableOpacity 
          onPress={sendMessage}
          style={[
            styles.sendButton,
            (!message.trim() || !isVerified) && styles.sendButtonDisabled
          ]}
          disabled={!message.trim() || !isVerified}
        >
          <Text style={styles.sendButtonText}>↑</Text>
        </TouchableOpacity>
      </View>

      {/* Verification Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verify Safety Number</Text>
            <Text style={styles.safetyNumber}>{safetyNumber}</Text>
            <Text style={styles.modalText}>
              Compare this number with your contact to verify their identity.
              If the numbers match, tap 'Verify' to mark this contact as verified.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.verifyConfirmButton]}
                onPress={markAsVerified}
              >
                <Text style={styles.verifyConfirmButtonText}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Key Management Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  keyStatusContainer: {
    padding: 16,
  },
  keyStatusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  keyStatusLabel: {
    fontSize: 15,
    color: '#666',
    marginRight: 10,
  },
  keyStatusValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusActive: {
    backgroundColor: '#DFF7E9',
  },
  statusWarning: {
    backgroundColor: '#FFE8E8',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  keyActions: {
    marginTop: 20,
    gap: 10,
  },
  actionButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotateButton: {
    backgroundColor: '#007AFF',
  },
  emergencyButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  keyInfoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  keyInfoText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Original styles
  container: {
    flex: 1,
    backgroundColor: '#FFF8EC',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFF8EC',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(74, 44, 42, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testButton: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#4A2C2A',
    borderRadius: 12,
  },
  testButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4A2C2A',
  },
  headerContent: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A2C2A',
  },
  contactStatus: {
    fontSize: 12,
    color: 'rgba(74, 44, 42, 0.6)',
  },
  verifyButton: {
    backgroundColor: '#4A2C2A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 12,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messagesContent: {
    paddingBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageWrapper: {
    marginBottom: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#4A2C2A',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#4A2C2A',
    marginBottom: 4,
  },
  myMessageText: {
    color: 'white',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(74, 44, 42, 0.6)',
    marginRight: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageStatus: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF8EC',
    borderTopWidth: 1,
    borderTopColor: 'rgba(74, 44, 42, 0.1)',
  },
  textInput: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    fontSize: 16,
    color: '#4A2C2A',
    borderWidth: 1,
    borderColor: 'rgba(74, 44, 42, 0.2)',
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#4A2C2A',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 1,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 20,
    marginLeft: 2,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A2C2A',
    marginBottom: 16,
    textAlign: 'center',
  },
  safetyNumber: {
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 16,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    letterSpacing: 1,
  },
  modalText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  cancelButtonText: {
    color: '#4A2C2A',
    fontWeight: '600',
  },
  verifyConfirmButton: {
    backgroundColor: '#4A2C2A',
  },
  verifyConfirmButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
