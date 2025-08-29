import { useState, useEffect } from 'react';
import FriendService from '../services/friends';
import { useAuth } from '../utils/auth/useAuth';

export function useFriendRequests() {
  const [pendingCount, setPendingCount] = useState(0);
  const { user } = useAuth();

  const refreshCount = async () => {
    if (!user) return;
    
    try {
      const count = await FriendService.friendRequests
        .where('toUserId')
        .equals(user.id)
        .and(req => req.status === 'pending')
        .count();
      
      setPendingCount(count);
    } catch (error) {
      console.error('Error fetching friend request count:', error);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    // Initial load
    refreshCount();
    
    // Set up real-time updates
    const subscription = FriendService.friendRequests
      .where('toUserId')
      .equals(user.id)
      .and(req => req.status === 'pending')
      .subscribe(() => {
        refreshCount();
      });
    
    return () => subscription.unsubscribe();
  }, [user]);

  return { pendingCount, refreshCount };
}
