import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ChatMessage from '../components/ChatMessage';
import messageService from '../services/messageService';
import authService from '../utils/authService';
import SecurityLogger from '../utils/securityLogger';

const ChatScreen = () => {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionKeys, setSessionKeys] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef(null);
  
  const route = useRoute();
  const navigation = useNavigation();
  const { chatId, recipient } = route.params;

  // Initialize chat session
  useEffect(() => {
    const initializeChat = async () => {
      try {
        // Initialize authentication and get session keys
        const auth = await authService.initializeAuth();
        setSessionKeys(auth.sessionKeys);
        
        // Load previous messages
        await loadMessages();
        
        // Set up message listeners
        setupMessageListeners();
        
        // Log chat opened
        await SecurityLogger.logEvent(
          SecurityLogger.EVENTS.CHAT_OPENED,
          { chatId, recipientId: recipient.id }
        );
        
      } catch (error) {
        console.error('Failed to initialize chat:', error);
        await SecurityLogger.logEvent(
          SecurityLogger.EVENTS.CHAT_ERROR,
          { 
            error: error.message,
            chatId,
            timestamp: Date.now()
          }
        );
      } finally {
        setIsLoading(false);
      }
    };

    initializeChat();

    // Clean up on unmount
    return () => {
      // Clean up listeners
    };
  }, []);

  const loadMessages = async () => {
    try {
      // Load messages from local storage or API
      // This is a placeholder - implement your actual message loading logic
      const loadedMessages = [];
      setMessages(loadedMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      await SecurityLogger.logEvent(
        SecurityLogger.EVENTS.MESSAGE_LOAD_ERROR,
        { error: error.message, chatId }
      );
    }
  };

  const setupMessageListeners = () => {
    // Set up WebSocket or other real-time message listeners
    // This is a placeholder - implement your actual message listener setup
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !sessionKeys || isSending) return;

    setIsSending(true);
    
    try {
      // Create a temporary message for immediate UI feedback
      const tempId = `temp-${Date.now()}`;
      const tempMessage = {
        id: tempId,
        content: messageText,
        isOutgoing: true,
        status: 'sending',
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, tempMessage]);
      setMessageText('');
      scrollToBottom();

      // Prepare and send the secure message
      const secureMessage = await messageService.prepareMessage(
        messageText,
        recipient.publicKey,
        {
          senderId: authService.getCurrentUserId(),
          keyId: sessionKeys.keyId,
          includeMetadata: true
        }
      );

      // Send the message (implement your actual sending logic)
      await sendSecureMessage(secureMessage);

      // Update the message status
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, id: secureMessage.id, status: 'sent' } 
            : msg
        )
      );

    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Update message status to show error
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, status: 'error', error: 'Failed to send' } 
            : msg
        )
      );
      
      await SecurityLogger.logEvent(
        SecurityLogger.Events.MESSAGE_SEND_ERROR,
        { 
          error: error.message,
          chatId,
          timestamp: Date.now()
        }
      );
    } finally {
      setIsSending(false);
    }
  };

  const sendSecureMessage = async (message) => {
    // Implement your actual message sending logic here
    // This could be a WebSocket connection, API call, etc.
    console.log('Sending secure message:', message);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In a real app, you would handle the server response here
    return { success: true, messageId: message.id };
  };

  const scrollToBottom = () => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  const renderMessage = ({ item }) => (
    <ChatMessage 
      message={item} 
      sessionKeys={sessionKeys}
    />
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Securing your conversation...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={scrollToBottom}
        onLayout={scrollToBottom}
      />
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
          editable={!isSending}
        />
        <TouchableOpacity 
          style={styles.sendButton}
          onPress={handleSendMessage}
          disabled={isSending || !messageText.trim()}
        >
          <Ionicons 
            name="send" 
            size={24} 
            color={!messageText.trim() || isSending ? '#ccc' : '#007AFF'} 
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  messagesContainer: {
    padding: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    marginRight: 8,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatScreen;
