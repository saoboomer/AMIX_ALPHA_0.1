import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  RefreshControl,
  Image
} from 'react-native';
import { useFriends } from '../contexts/FriendContext';
import { MaterialIcons } from '@expo/vector-icons';

const FriendRequests = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { 
    pendingRequests, 
    acceptFriendRequest, 
    rejectFriendRequest, 
    refreshRequests 
  } = useFriends();
  const [error, setError] = useState('');

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await refreshRequests();
    } catch (err) {
      setError('Failed to refresh requests');
      console.error('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      await acceptFriendRequest(requestId);
    } catch (err) {
      setError(err.message || 'Failed to accept request');
    }
  };

  const handleReject = async (requestId) => {
    try {
      await rejectFriendRequest(requestId);
    } catch (err) {
      setError(err.message || 'Failed to reject request');
    }
  };

  const renderRequestItem = ({ item }) => {
    const requestDate = new Date(item.createdAt);
    const timeAgo = getTimeAgo(requestDate);
    
    return (
      <View style={styles.requestItem}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarPlaceholder}>
            <MaterialIcons name="person" size={32} color="#666" />
          </View>
        </View>
        
        <View style={styles.requestInfo}>
          <Text style={styles.username}>{item.fromUser?.username || 'Unknown User'}</Text>
          <Text style={styles.timestamp}>
            {timeAgo}
          </Text>
        </View>
        
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.declineButton]}
            onPress={() => handleReject(item.id)}
          >
            <MaterialIcons name="close" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAccept(item.id)}
          >
            <MaterialIcons name="check" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return `${interval}y ago`;
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return `${interval}mo ago`;
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval}d ago`;
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval}h ago`;
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval}m ago`;
    
    return 'Just now';
  };
  
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="person-add" size={64} color="#e0e0e0" />
      <Text style={styles.emptyText}>No pending friend requests</Text>
      <Text style={styles.emptySubtext}>When someone sends you a friend request, it will appear here</Text>
    </View>
  );
  
  const renderError = () => (
    <View style={styles.errorContainer}>
      <MaterialIcons name="error-outline" size={48} color="#ff3b30" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity 
        style={styles.retryButton}
        onPress={handleRefresh}
      >
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
  
  if (error) return renderError();


  return (
    <View style={styles.container}>
      <FlatList
        data={pendingRequests}
        keyExtractor={(item) => item.id}
        renderItem={renderRequestItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
      />
    </View>
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#1C1C1E',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#8E8E93',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  listContainer: {
    paddingVertical: 8,
  },
  requestItem: {
    backgroundColor: '#fff',
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestInfo: {
    flex: 1,
  },
  username: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 13,
    color: '#8E8E93',
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default FriendRequests;
