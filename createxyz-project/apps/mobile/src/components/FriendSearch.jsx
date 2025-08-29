import React, { useState, useEffect } from 'react';
import { View, TextInput, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Text } from 'react-native';
import { useFriends } from '../contexts/FriendContext';

const FriendSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { sendFriendRequest, friends } = useFriends();

  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsLoading(true);
      setError('');
      
      try {
        // In a real app, you would call your backend API here
        // For now, we'll simulate a search with a timeout
        const results = await new Promise(resolve => {
          setTimeout(() => {
            // Mock data - in a real app, this would come from your backend
            const mockResults = [
              { id: '1', username: 'user1', publicKey: 'key1' },
              { id: '2', username: 'user2', publicKey: 'key2' },
            ].filter(user => 
              user.username.toLowerCase().includes(searchQuery.toLowerCase())
            );
            resolve(mockResults);
          }, 500);
        });
        
        // Filter out existing friends
        const friendIds = new Set(friends.map(f => f.id));
        const filteredResults = results.filter(user => !friendIds.has(user.id));
        
        setSearchResults(filteredResults);
      } catch (err) {
        setError('Failed to search users');
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, friends]);

  const handleAddFriend = async (username) => {
    try {
      await sendFriendRequest(username);
      // Update UI to show request sent
      setSearchResults(prev => 
        prev.map(u => 
          u.username === username ? { ...u, requestSent: true } : u
        )
      );
    } catch (err) {
      setError(err.message || 'Failed to send friend request');
    }
  };

  const renderUserItem = ({ item }) => (
    <View style={styles.userItem}>
      <View>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={styles.userId}>@{item.username}</Text>
      </View>
      {item.requestSent ? (
        <Text style={styles.requestSentText}>Request Sent</Text>
      ) : (
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => handleAddFriend(item.username)}
        >
          <Text style={styles.addButtonText}>Add Friend</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search for friends..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      
      {isLoading ? (
        <ActivityIndicator style={styles.loader} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          style={styles.resultsList}
        />
      ) : searchQuery.length >= 2 ? (
        <Text style={styles.noResults}>No users found</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  searchInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  loader: {
    marginTop: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 10,
  },
  noResults: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userId: {
    fontSize: 14,
    color: '#666',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  requestSentText: {
    color: '#666',
    fontStyle: 'italic',
  },
  resultsList: {
    flex: 1,
  },
});

export default FriendSearch;
