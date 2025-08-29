import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { AmiXStorage } from '../utils/storage';
import { AmiXCrypto } from '../utils/crypto';

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const MessageReactions = ({ message, currentUserId, onReaction }) => {
  const [reactions, setReactions] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Load reactions for this message
  useEffect(() => {
    const loadReactions = async () => {
      try {
        const summary = await AmiXStorage.getReactionSummary(message.id);
        setReactions(summary);
      } catch (error) {
        console.error('Failed to load reactions:', error);
      }
    };

    loadReactions();
  }, [message.id]);

  const handleReaction = async (emoji) => {
    try {
      setShowEmojiPicker(false);
      await onReaction(message.id, emoji);
      
      // Update local state optimistically
      const newReactions = { ...reactions };
      
      // Check if user already reacted with this emoji
      const userReacted = Object.entries(reactions).some(
        ([e, data]) => data.users.includes(currentUserId) && e === emoji
      );
      
      if (userReacted) {
        // Remove reaction
        const updatedUsers = reactions[emoji].users.filter(id => id !== currentUserId);
        if (updatedUsers.length === 0) {
          delete newReactions[emoji];
        } else {
          newReactions[emoji] = {
            count: updatedUsers.length,
            users: updatedUsers
          };
        }
      } else {
        // Add new reaction
        if (!newReactions[emoji]) {
          newReactions[emoji] = { count: 0, users: [] };
        }
        newReactions[emoji].count++;
        newReactions[emoji].users.push(currentUserId);
      }
      
      setReactions(newReactions);
    } catch (error) {
      console.error('Failed to handle reaction:', error);
    }
  };

  const renderEmoji = ({ item: emoji }) => (
    <TouchableOpacity 
      style={styles.emojiButton}
      onPress={() => handleReaction(emoji)}
    >
      <Text style={styles.emoji}>{emoji}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Reaction summary bar */}
      <View style={styles.reactionBar}>
        {Object.entries(reactions).map(([emoji, data]) => (
          <TouchableOpacity 
            key={emoji} 
            style={[
              styles.reactionPill,
              data.users.includes(currentUserId) && styles.userReaction
            ]}
            onPress={() => handleReaction(emoji)}
          >
            <Text style={styles.emoji}>{emoji}</Text>
            <Text style={styles.count}>{data.count}</Text>
          </TouchableOpacity>
        ))}
        
        <TouchableOpacity 
          style={styles.addReactionButton}
          onPress={() => setShowEmojiPicker(true)}
        >
          <Text style={styles.addReactionText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Emoji picker modal */}
      <Modal
        visible={showEmojiPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmojiPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.emojiPicker}>
            <FlatList
              data={EMOJI_LIST}
              renderItem={renderEmoji}
              keyExtractor={(item) => item}
              numColumns={6}
              contentContainerStyle={styles.emojiGrid}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  reactionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  userReaction: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderColor: 'rgba(0, 122, 255, 0.3)',
  },
  emoji: {
    fontSize: 14,
  },
  count: {
    fontSize: 12,
    marginLeft: 2,
    color: '#666',
  },
  addReactionButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addReactionText: {
    fontSize: 16,
    color: '#666',
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiPicker: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    maxWidth: '80%',
  },
  emojiGrid: {
    justifyContent: 'center',
  },
  emojiButton: {
    padding: 8,
    borderRadius: 20,
  },
});

export default MessageReactions;
