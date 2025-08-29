import React, { memo, useMemo, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";

// Memoized conversation item component
const ConversationItem = memo(({ conversation, onPress }) => {
  const itemStyles = useMemo(() => ({
    container: {
      backgroundColor: '#FFFFFF',
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 20,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#FFF1D6',
      alignItems: "center",
      justifyContent: "center",
      marginRight: 16,
    },
    avatarText: {
      fontSize: 18,
      color: '#4A2C2A',
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      color: '#4A2C2A',
      fontWeight: '600',
      marginBottom: 4,
    },
    message: {
      fontSize: 14,
      color: 'rgba(74, 44, 42, 0.7)',
    },
    timestamp: {
      fontSize: 12,
      color: 'rgba(74, 44, 42, 0.5)',
      marginLeft: 8,
    },
    unreadBadge: {
      backgroundColor: '#FFF1D6',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },
    unreadText: {
      fontSize: 12,
      color: '#4A2C2A',
      fontWeight: '600',
    }
  }), []);

  const handlePress = useCallback(() => {
    onPress?.(conversation);
  }, [conversation, onPress]);

  return (
    <TouchableOpacity 
      style={[itemStyles.container, { pointerEvents: 'auto' }]} 
      onPress={handlePress}
    >
      <View style={itemStyles.avatar}>
        <Text style={itemStyles.avatarText}>{conversation.avatar}</Text>
      </View>
      <View style={itemStyles.content}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <Text style={itemStyles.name}>{conversation.name}</Text>
          <Text style={itemStyles.timestamp}>{conversation.timestamp}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={itemStyles.message} numberOfLines={1}>
            {conversation.lastMessage}
          </Text>
          {conversation.unreadCount > 0 && (
            <View style={itemStyles.unreadBadge}>
              <Text style={itemStyles.unreadText}>
                {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

ConversationItem.displayName = 'ConversationItem';

const ChatsScreen = memo(() => {
  const styles = useMemo(() => ({
    container: {
      flex: 1, 
      backgroundColor: '#FFF8EC',
    },
    header: {
      paddingTop: 64,
      paddingHorizontal: 16,
      paddingBottom: 16,
      backgroundColor: '#FFF8EC',
    },
    title: {
      fontSize: 24, 
      color: '#4A2C2A', 
      fontWeight: '700',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 12,
      color: 'rgba(74, 44, 42, 0.7)',
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    scrollContent: {
      paddingTop: 16,
      paddingBottom: 100,
    }
  }), []);

  const conversations = useMemo(() => [
    {
      id: "1",
      name: "Alex Chen",
      amiXID: "AX7kP2nW",
      lastMessage: "Hey! How are you doing?",
      timestamp: "5m",
      unreadCount: 2,
      isOnline: true,
      avatar: "AC",
    },
    {
      id: "2",
      name: "Sarah Miller",
      amiXID: "SM9uQ5vR",
      lastMessage: "Thanks for the photos from last weekend",
      timestamp: "2h",
      unreadCount: 0,
      isOnline: false,
      avatar: "SM",
    },
    {
      id: "3",
      name: "Dev Team",
      amiXID: "DT2wE8kL",
      lastMessage: "Meeting at 3pm tomorrow",
      timestamp: "1d",
      unreadCount: 1,
      isOnline: true,
      avatar: "DT",
      isGroup: true,
    },
  ], []);

  const handleConversationPress = useCallback((conversation) => {
    console.log('Conversation pressed:', conversation.name);
  }, []);

  const renderConversation = useCallback((conversation) => (
    <ConversationItem 
      key={conversation.id} 
      conversation={conversation} 
      onPress={handleConversationPress}
    />
  ), [handleConversationPress]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AmiX</Text>
        <Text style={styles.subtitle}>DEMO123</Text>
      </View>
      
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {conversations.map(renderConversation)}
      </ScrollView>
    </View>
  );
});

ChatsScreen.displayName = 'ChatsScreen';

export default ChatsScreen;
