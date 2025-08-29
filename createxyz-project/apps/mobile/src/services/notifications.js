import { AmiXStorage } from '../utils/storage';
import { AmiXCrypto } from '../utils/crypto';
import { AmiXAnalytics } from '../utils/analytics';
import * as Notifications from 'expo-notifications';

// AmiX Advanced Notification System
// Provides encrypted notifications, smart grouping, and privacy controls

export class AmiXNotifications {
  static notificationQueue = [];
  static notificationGroups = new Map();
  static notificationSettings = {};
  static maxNotifications = 100;
  static groupTimeout = 5 * 60 * 1000; // 5 minutes

  // Notification types
  static NOTIFICATION_TYPES = {
    MESSAGE: 'message',
    CALL: 'call',
    FILE: 'file',
    GROUP: 'group',
    ACHIEVEMENT: 'achievement',
    SYSTEM: 'system',
    SECURITY: 'security',
  };

  // Notification priorities
  static PRIORITIES = {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high',
    URGENT: 'urgent',
  };

  static async initialize() {
    try {
      // Request notification permissions
      await this.requestPermissions();
      
      // Load notification settings
      await this.loadNotificationSettings();
      
      // Set up notification handlers
      this.setupNotificationHandlers();
      
      // Start notification processing
      this.startNotificationProcessing();
      
      return true;
    } catch (error) {
      console.error('Notification system initialization failed:', error);
      return false;
    }
  }

  // Request notification permissions
  static async requestPermissions() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        throw new Error('Notification permissions not granted');
      }

      // Configure notification behavior
      await Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          };
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  }

  // Load notification settings
  static async loadNotificationSettings() {
    try {
      const settings = await AmiXStorage.get('notification_settings');
      if (!settings) {
        // Default settings
        this.notificationSettings = {
          enabled: true,
          sound: true,
          vibration: true,
          badge: true,
          preview: true,
          groupMessages: true,
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00',
          },
          types: {
            message: { enabled: true, priority: this.PRIORITIES.NORMAL },
            call: { enabled: true, priority: this.PRIORITIES.HIGH },
            file: { enabled: true, priority: this.PRIORITIES.NORMAL },
            group: { enabled: true, priority: this.PRIORITIES.NORMAL },
            achievement: { enabled: true, priority: this.PRIORITIES.LOW },
            system: { enabled: false, priority: this.PRIORITIES.LOW },
            security: { enabled: true, priority: this.PRIORITIES.URGENT },
          },
          contacts: {}, // Per-contact settings
        };
        await AmiXStorage.store('notification_settings', this.notificationSettings);
      } else {
        this.notificationSettings = settings;
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }

  // Set up notification handlers
  static setupNotificationHandlers() {
    // Handle notification received while app is running
    Notifications.addNotificationReceivedListener((notification) => {
      this.handleNotificationReceived(notification);
    });

    // Handle notification response (user tapped notification)
    Notifications.addNotificationResponseReceivedListener((response) => {
      this.handleNotificationResponse(response);
    });
  }

  // Start notification processing
  static startNotificationProcessing() {
    setInterval(() => {
      this.processNotificationQueue();
    }, 1000); // Process every second
  }

  // Send encrypted notification
  static async sendNotification(type, data, options = {}) {
    try {
      // Check if notifications are enabled
      if (!this.notificationSettings.enabled) {
        return false;
      }

      // Check quiet hours
      if (this.isInQuietHours()) {
        return false;
      }

      // Check type-specific settings
      const typeSettings = this.notificationSettings.types[type];
      if (!typeSettings || !typeSettings.enabled) {
        return false;
      }

      // Create notification object
      const notification = {
        id: await AmiXCrypto.generateSecureUUID(),
        type,
        data,
        priority: options.priority || typeSettings.priority,
        timestamp: Date.now(),
        senderId: data.senderId,
        encrypted: options.encrypted || false,
        groupable: options.groupable !== false,
      };

      // Add to queue
      this.notificationQueue.push(notification);

      // Track analytics
      await AmiXAnalytics.trackEvent('notification_queued', {
        type,
        priority: notification.priority,
      });

      return notification.id;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }

  // Process notification queue
  static async processNotificationQueue() {
    try {
      if (this.notificationQueue.length === 0) return;

      const now = Date.now();
      const processedNotifications = [];

      for (const notification of this.notificationQueue) {
        // Check if notification should be grouped
        if (notification.groupable && this.shouldGroupNotification(notification)) {
          await this.addToNotificationGroup(notification);
        } else {
          await this.displayNotification(notification);
        }

        processedNotifications.push(notification);
      }

      // Remove processed notifications from queue
      this.notificationQueue = this.notificationQueue.filter(
        n => !processedNotifications.includes(n)
      );

      // Clean up old notification groups
      this.cleanupNotificationGroups(now);
    } catch (error) {
      console.error('Failed to process notification queue:', error);
    }
  }

  // Check if notification should be grouped
  static shouldGroupNotification(notification) {
    if (!this.notificationSettings.groupMessages) return false;

    const groupKey = this.getNotificationGroupKey(notification);
    const group = this.notificationGroups.get(groupKey);

    if (!group) return false;

    // Group if within timeout and same type
    return (Date.now() - group.lastNotification) < this.groupTimeout &&
           group.type === notification.type;
  }

  // Add notification to group
  static async addToNotificationGroup(notification) {
    try {
      const groupKey = this.getNotificationGroupKey(notification);
      let group = this.notificationGroups.get(groupKey);

      if (!group) {
        group = {
          id: await AmiXCrypto.generateSecureUUID(),
          type: notification.type,
          senderId: notification.senderId,
          notifications: [],
          count: 0,
          lastNotification: Date.now(),
        };
        this.notificationGroups.set(groupKey, group);
      }

      group.notifications.push(notification);
      group.count++;
      group.lastNotification = Date.now();

      // Update existing notification
      await this.updateGroupedNotification(group);
    } catch (error) {
      console.error('Failed to add notification to group:', error);
    }
  }

  // Display individual notification
  static async displayNotification(notification) {
    try {
      // Prepare notification content
      const content = await this.prepareNotificationContent(notification);

      // Create notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: content.title,
          body: content.body,
          data: content.data,
          sound: this.notificationSettings.sound ? 'default' : null,
          badge: this.notificationSettings.badge ? 1 : null,
        },
        trigger: null, // Show immediately
      });

      // Track analytics
      await AmiXAnalytics.trackEvent('notification_displayed', {
        type: notification.type,
        priority: notification.priority,
      });
    } catch (error) {
      console.error('Failed to display notification:', error);
    }
  }

  // Update grouped notification
  static async updateGroupedNotification(group) {
    try {
      const content = await this.prepareGroupedNotificationContent(group);

      // Cancel existing notification if exists
      await Notifications.cancelScheduledNotificationAsync(group.id);

      // Create updated notification
      await Notifications.scheduleNotificationAsync({
        identifier: group.id,
        content: {
          title: content.title,
          body: content.body,
          data: content.data,
          sound: this.notificationSettings.sound ? 'default' : null,
          badge: this.notificationSettings.badge ? group.count : null,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Failed to update grouped notification:', error);
    }
  }

  // Prepare notification content
  static async prepareNotificationContent(notification) {
    try {
      let title = '';
      let body = '';
      let data = { ...notification.data };

      switch (notification.type) {
        case this.NOTIFICATION_TYPES.MESSAGE:
          title = notification.data.senderName || 'New Message';
          body = this.notificationSettings.preview ? 
            (notification.encrypted ? '[Encrypted Message]' : notification.data.content) :
            'You have a new message';
          break;

        case this.NOTIFICATION_TYPES.CALL:
          title = 'Incoming Call';
          body = `${notification.data.senderName || 'Unknown'} is calling...`;
          break;

        case this.NOTIFICATION_TYPES.FILE:
          title = 'File Received';
          body = `${notification.data.senderName || 'Someone'} sent you a file`;
          break;

        case this.NOTIFICATION_TYPES.GROUP:
          title = 'Group Update';
          body = notification.data.message || 'Group activity';
          break;

        case this.NOTIFICATION_TYPES.ACHIEVEMENT:
          title = 'Achievement Unlocked!';
          body = notification.data.achievementTitle || 'New achievement';
          break;

        case this.NOTIFICATION_TYPES.SECURITY:
          title = 'Security Alert';
          body = notification.data.message || 'Security notification';
          break;

        default:
          title = 'AmiX Notification';
          body = notification.data.message || 'You have a new notification';
      }

      return { title, body, data };
    } catch (error) {
      console.error('Failed to prepare notification content:', error);
      return {
        title: 'AmiX Notification',
        body: 'You have a new notification',
        data: notification.data,
      };
    }
  }

  // Prepare grouped notification content
  static async prepareGroupedNotificationContent(group) {
    try {
      const senderName = group.notifications[0]?.data.senderName || 'Someone';
      const title = `${senderName}`;
      const body = `${group.count} new ${group.type}${group.count > 1 ? 's' : ''}`;

      return {
        title,
        body,
        data: {
          type: 'grouped',
          groupId: group.id,
          count: group.count,
          notifications: group.notifications,
        },
      };
    } catch (error) {
      console.error('Failed to prepare grouped notification content:', error);
      return {
        title: 'New Messages',
        body: 'You have new messages',
        data: { type: 'grouped' },
      };
    }
  }

  // Get notification group key
  static getNotificationGroupKey(notification) {
    return `${notification.type}_${notification.senderId}`;
  }

  // Clean up old notification groups
  static cleanupNotificationGroups(now) {
    for (const [key, group] of this.notificationGroups) {
      if (now - group.lastNotification > this.groupTimeout) {
        this.notificationGroups.delete(key);
      }
    }
  }

  // Handle notification received
  static async handleNotificationReceived(notification) {
    try {
      // Store notification in history
      await this.storeNotificationInHistory(notification);

      // Update badge count
      if (this.notificationSettings.badge) {
        await this.updateBadgeCount();
      }
    } catch (error) {
      console.error('Failed to handle notification received:', error);
    }
  }

  // Handle notification response
  static async handleNotificationResponse(response) {
    try {
      const { notification } = response;
      const data = notification.request.content.data;

      // Mark notification as read
      await this.markNotificationAsRead(notification.request.identifier);

      // Handle different notification types
      switch (data.type) {
        case this.NOTIFICATION_TYPES.MESSAGE:
          // Navigate to conversation
          this.navigateToConversation(data.senderId);
          break;

        case this.NOTIFICATION_TYPES.CALL:
          // Handle call response
          this.handleCallResponse(data);
          break;

        case this.NOTIFICATION_TYPES.FILE:
          // Navigate to file
          this.navigateToFile(data);
          break;

        case this.NOTIFICATION_TYPES.GROUP:
          // Navigate to group
          this.navigateToGroup(data.groupId);
          break;

        case this.NOTIFICATION_TYPES.ACHIEVEMENT:
          // Show achievement details
          this.showAchievementDetails(data);
          break;

        case this.NOTIFICATION_TYPES.SECURITY:
          // Navigate to security settings
          this.navigateToSecuritySettings();
          break;
      }

      // Track analytics
      await AmiXAnalytics.trackEvent('notification_tapped', {
        type: data.type,
        notificationId: notification.request.identifier,
      });
    } catch (error) {
      console.error('Failed to handle notification response:', error);
    }
  }

  // Store notification in history
  static async storeNotificationInHistory(notification) {
    try {
      const history = await AmiXStorage.get('notification_history') || [];
      
      const notificationRecord = {
        id: notification.request.identifier,
        type: notification.request.content.data.type,
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data,
        timestamp: Date.now(),
        read: false,
      };

      history.unshift(notificationRecord);

      // Keep only recent notifications
      if (history.length > this.maxNotifications) {
        history.splice(this.maxNotifications);
      }

      await AmiXStorage.store('notification_history', history);
    } catch (error) {
      console.error('Failed to store notification in history:', error);
    }
  }

  // Mark notification as read
  static async markNotificationAsRead(notificationId) {
    try {
      const history = await AmiXStorage.get('notification_history') || [];
      const notification = history.find(n => n.id === notificationId);
      
      if (notification) {
        notification.read = true;
        await AmiXStorage.store('notification_history', history);
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  // Update badge count
  static async updateBadgeCount() {
    try {
      const history = await AmiXStorage.get('notification_history') || [];
      const unreadCount = history.filter(n => !n.read).length;
      
      await Notifications.setBadgeCountAsync(unreadCount);
    } catch (error) {
      console.error('Failed to update badge count:', error);
    }
  }

  // Check if in quiet hours
  static isInQuietHours() {
    const quietHours = this.notificationSettings.quietHours;
    if (!quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const startTime = this.parseTime(quietHours.start);
    const endTime = this.parseTime(quietHours.end);

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight quiet hours
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  // Parse time string (HH:MM)
  static parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Update notification settings
  static async updateNotificationSettings(settings) {
    try {
      this.notificationSettings = { ...this.notificationSettings, ...settings };
      await AmiXStorage.store('notification_settings', this.notificationSettings);
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    }
  }

  // Clear all notifications
  static async clearAllNotifications() {
    try {
      await Notifications.dismissAllNotificationsAsync();
      await Notifications.setBadgeCountAsync(0);
      
      this.notificationQueue = [];
      this.notificationGroups.clear();
      
      await AmiXStorage.store('notification_history', []);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }

  // Get notification history
  static async getNotificationHistory(limit = 50) {
    try {
      const history = await AmiXStorage.get('notification_history') || [];
      return history.slice(0, limit);
    } catch (error) {
      console.error('Failed to get notification history:', error);
      return [];
    }
  }

  // Navigation handlers (to be implemented in your app)
  static navigateToConversation(senderId) {
    console.log('Navigate to conversation:', senderId);
    // Implement navigation logic
  }

  static handleCallResponse(data) {
    console.log('Handle call response:', data);
    // Implement call handling logic
  }

  static navigateToFile(data) {
    console.log('Navigate to file:', data);
    // Implement file navigation logic
  }

  static navigateToGroup(groupId) {
    console.log('Navigate to group:', groupId);
    // Implement group navigation logic
  }

  static showAchievementDetails(data) {
    console.log('Show achievement details:', data);
    // Implement achievement display logic
  }

  static navigateToSecuritySettings() {
    console.log('Navigate to security settings');
    // Implement security settings navigation logic
  }
}
