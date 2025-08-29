import React, { createContext, useContext, useEffect, useState } from 'react';
import FriendService from '../services/friends';
import { useAuth } from '../utils/auth/useAuth';
import { signalingService } from '../services/signaling';

const FriendContext = createContext();

export const FriendProvider = ({ children }) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadFriends = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const friendList = await FriendService.getFriends(user.id);
      setFriends(friendList);
    } catch (err) {
      console.error('Failed to load friends:', err);
      setError('Failed to load friends');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFriendRequests = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const requests = await FriendService.friendRequests
        .where('toUserId')
        .equals(user.id)
        .and(req => req.status === 'pending')
        .toArray();
      
      setPendingRequests(requests);
    } catch (err) {
      console.error('Failed to load friend requests:', err);
      setError('Failed to load friend requests');
    } finally {
      setIsLoading(false);
    }
  };

  const sendFriendRequest = async (toUsername) => {
    if (!user) throw new Error('Not authenticated');
    
    try {
      const request = await FriendService.sendFriendRequest(user.id, toUsername);
      // In a real app, you would send this via the signaling service
      // await signalingService.sendFriendRequest(toUserId);
      return request;
    } catch (err) {
      console.error('Failed to send friend request:', err);
      throw err;
    }
  };

  const acceptFriendRequest = async (requestId) => {
    if (!user) throw new Error('Not authenticated');
    
    try {
      const request = await FriendService.friendRequests.get(requestId);
      if (!request) throw new Error('Friend request not found');
      
      await FriendService.respondToFriendRequest(requestId, true);
      
      // Update local state
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));
      await loadFriends();
      
      // In a real app, notify the other user via signaling
      // await signalingService.acceptFriendRequest(request.fromUserId);
      
      return true;
    } catch (err) {
      console.error('Failed to accept friend request:', err);
      throw err;
    }
  };

  const rejectFriendRequest = async (requestId) => {
    if (!user) throw new Error('Not authenticated');
    
    try {
      await FriendService.respondToFriendRequest(requestId, false);
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));
      return true;
    } catch (err) {
      console.error('Failed to reject friend request:', err);
      throw err;
    }
  };

  const removeFriend = async (friendId) => {
    if (!user) throw new Error('Not authenticated');
    
    try {
      // In a real app, you would also notify the other user
      // and clean up any related data
      await FriendService.friendships
        .where('[user1Id+user2Id]')
        .equals([user.id, friendId].sort())
        .delete();
      
      await loadFriends();
      return true;
    } catch (err) {
      console.error('Failed to remove friend:', err);
      throw err;
    }
  };

  // Load initial data when user changes
  useEffect(() => {
    if (user) {
      loadFriends();
      loadFriendRequests();
      
      // Initialize signaling service
      signalingService.initialize(user.id);
      
      // Set up signaling event listeners
      const handleFriendRequest = (message) => {
        console.log('Received friend request:', message);
        loadFriendRequests();
      };
      
      const handleFriendRequestAccepted = (message) => {
        console.log('Friend request accepted:', message);
        loadFriends();
      };
      
      signalingService.on('friend-request', handleFriendRequest);
      signalingService.on('friend-request-accepted', handleFriendRequestAccepted);
      
      return () => {
        signalingService.off('friend-request', handleFriendRequest);
        signalingService.off('friend-request-accepted', handleFriendRequestAccepted);
      };
    } else {
      setFriends([]);
      setPendingRequests([]);
    }
  }, [user]);

  return (
    <FriendContext.Provider
      value={{
        friends,
        pendingRequests,
        isLoading,
        error,
        sendFriendRequest,
        acceptFriendRequest,
        rejectFriendRequest,
        removeFriend,
        refreshFriends: loadFriends,
        refreshRequests: loadFriendRequests,
      }}
    >
      {children}
    </FriendContext.Provider>
  );
};

export const useFriends = () => {
  const context = useContext(FriendContext);
  if (!context) {
    throw new Error('useFriends must be used within a FriendProvider');
  }
  return context;
};

export default FriendContext;
