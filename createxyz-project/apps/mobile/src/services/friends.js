import { AmiXStorage } from '../utils/storage';
import { AmiXCrypto } from '../utils/crypto';

class FriendService {
  static async initialize() {
    this.db = await AmiXStorage.initialize();
    this.users = this.db.users;
    this.friendRequests = this.db.friendRequests;
    this.friendships = this.db.friendships;
    this.userSearch = this.db.userSearch;
  }

  // User Management
  static async createUser(userData) {
    const { username, publicKey } = userData;
    
    // Check if username exists
    const existingUser = await this.users.get({ username });
    if (existingUser) {
      throw new Error('Username already exists');
    }

    const userId = await AmiXCrypto.generateSecureUUID();
    const user = {
      id: userId,
      username,
      publicKey,
      status: 'offline',
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await this.users.add(user);
    await this.updateSearchIndex(user);
    return user;
  }

  static async updateUser(userId, updates) {
    await this.users.update(userId, updates);
    if (updates.username) {
      const user = await this.users.get(userId);
      await this.updateSearchIndex(user);
    }
  }

  static async getUser(userId) {
    return this.users.get(userId);
  }

  static async getUserByUsername(username) {
    return this.users.get({ username });
  }

  // Friend Requests
  static async sendFriendRequest(fromUserId, toUsername) {
    const toUser = await this.getUserByUsername(toUsername);
    if (!toUser) {
      throw new Error('User not found');
    }

    if (fromUserId === toUser.id) {
      throw new Error('Cannot send friend request to yourself');
    }

    // Check if request already exists
    const existingRequest = await this.friendRequests
      .where('[fromUserId+toUserId]')
      .equals([fromUserId, toUser.id])
      .first();

    if (existingRequest) {
      throw new Error('Friend request already sent');
    }

    // Check if already friends
    const existingFriendship = await this.getFriendship(fromUserId, toUser.id);
    if (existingFriendship) {
      throw new Error('Already friends with this user');
    }

    const request = {
      id: await AmiXCrypto.generateSecureUUID(),
      fromUserId,
      toUserId: toUser.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await this.friendRequests.add(request);
    
    // In a real app, you would notify the other user here
    // this.notifyUser(toUser.id, 'friendRequest', { fromUserId });
    
    return request;
  }

  static async respondToFriendRequest(requestId, accept) {
    const request = await this.friendRequests.get(requestId);
    if (!request) {
      throw new Error('Friend request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Friend request already processed');
    }

    if (accept) {
      // Create friendship
      await this.createFriendship(request.fromUserId, request.toUserId);
    }

    // Update request status
    await this.friendRequests.update(requestId, {
      status: accept ? 'accepted' : 'rejected',
      respondedAt: new Date().toISOString()
    });

    return { success: true, accepted: accept };
  }

  // Friendships
  static async createFriendship(user1Id, user2Id) {
    // Sort IDs to ensure consistency
    const [id1, id2] = [user1Id, user2Id].sort();
    
    const friendship = {
      id: await AmiXCrypto.generateSecureUUID(),
      user1Id: id1,
      user2Id: id2,
      status: 'active',
      establishedAt: new Date().toISOString()
    };

    await this.friendships.add(friendship);
    return friendship;
  }

  static async getFriendship(user1Id, user2Id) {
    const [id1, id2] = [user1Id, user2Id].sort();
    return this.friendships
      .where('[user1Id+user2Id]')
      .equals([id1, id2])
      .first();
  }

  static async getFriends(userId) {
    const friendships = await this.friendships
      .where('user1Id')
      .equals(userId)
      .or('user2Id')
      .equals(userId)
      .and(f => f.status === 'active')
      .toArray();

    const friendIds = friendships.map(f => 
      f.user1Id === userId ? f.user2Id : f.user1Id
    );

    return Promise.all(friendIds.map(id => this.getUser(id)));
  }

  // Search
  static async searchUsers(query, limit = 10) {
    if (!query || query.length < 2) {
      return [];
    }

    const searchTerms = query.toLowerCase().split(/\s+/);
    const results = await this.userSearch
      .where('searchTerms')
      .startsWithAnyOfIgnoreCase(searchTerms)
      .distinct()
      .limit(limit)
      .toArray();

    const userIds = results.map(r => r.userId);
    return this.users.where('id').anyOf(userIds).toArray();
  }

  // Helpers
  static async updateSearchIndex(user) {
    const searchTerms = [
      user.username.toLowerCase(),
      ...user.username.toLowerCase().split(/[-_.]/),
    ].filter(Boolean);

    await this.userSearch.put({
      id: user.id,
      userId: user.id,
      username: user.username,
      searchTerms,
    });
  }

  // Initialize the service
  static async init() {
    if (!this.initialized) {
      await this.initialize();
      this.initialized = true;
    }
    return this;
  }
}

// Initialize the service when imported
FriendService.init().catch(console.error);

export default FriendService;
