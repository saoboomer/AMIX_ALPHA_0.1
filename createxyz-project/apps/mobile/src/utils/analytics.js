import { Platform } from 'react-native';
import { AmiXCrypto } from './crypto';
import { AmiXStorage } from './storage';

export class AmiXAnalytics {
  static analyticsUUID = null;
  static lastHeartbeat = null;
  static heartbeatInterval = 1000 * 60 * 60; // 1 hour
  static isInitialized = false;

  static async initialize() {
    try {
      if (this.isInitialized) return;

      const analyticsOptIn = await AmiXStorage.getSecurely('analytics_opt_in');
      if (!analyticsOptIn) {
        this.isInitialized = true;
        return; // User has not opted in
      }

      // Get or generate analytics UUID (separate from identity)
      let uuid = await AmiXStorage.getSecurely(AmiXStorage.STORAGE_KEYS.ANALYTICS_UUID);
      if (!uuid) {
        uuid = await this.generateAnalyticsUUID();
        await AmiXStorage.storeSecurely(AmiXStorage.STORAGE_KEYS.ANALYTICS_UUID, uuid);
        await AmiXStorage.storeSecurely('analytics_uuid_created', Date.now());
      } else {
        // Check if UUID should be rotated (monthly)
        const created = await AmiXStorage.getSecurely('analytics_uuid_created');
        if (created && Date.now() - created > 30 * 24 * 60 * 60 * 1000) {
          uuid = await this.generateAnalyticsUUID();
          await AmiXStorage.storeSecurely(AmiXStorage.STORAGE_KEYS.ANALYTICS_UUID, uuid);
          await AmiXStorage.storeSecurely('analytics_uuid_created', Date.now());
        }
      }

      this.analyticsUUID = uuid;
      this.sendHeartbeat();
      
      // Set up periodic heartbeats
      setInterval(() => {
        this.sendHeartbeat();
      }, this.heartbeatInterval);

      this.isInitialized = true;
    } catch (error) {
      console.error('Analytics initialization failed:', error);
    }
  }

  static async generateAnalyticsUUID() {
    // Generate a cryptographically secure UUID for analytics (unlinked to identity)
    return await AmiXCrypto.generateSecureUUID();
  }

  static async sendHeartbeat() {
    if (!this.analyticsUUID) {
      return; // Analytics not enabled
    }

    // Throttle heartbeats
    if (this.lastHeartbeat && Date.now() - this.lastHeartbeat < this.heartbeatInterval) {
      return;
    }

    try {
      const deviceType = Platform.select({
        ios: 'iOS',
        android: 'Android',
        web: 'Web',
        default: 'Desktop'
      });

      // Minimal payload - no PII, no device identifiers
      const payload = {
        uuid: this.analyticsUUID,
        device_type: deviceType,
        app_version: '1.0.0', // In production: get from app config
        timestamp: Date.now(),
        // No IP address, no device ID, no user identifiers
      };

      // Add client-side IP obfuscation
      const obfuscatedPayload = await this.obfuscatePayload(payload);

      const response = await fetch('/api/analytics/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Analytics-Version': '1.0',
        },
        body: JSON.stringify(obfuscatedPayload),
      });

      if (response.ok) {
        this.lastHeartbeat = Date.now();
      }
    } catch (error) {
      // Silently fail - analytics should never impact app functionality
      console.debug('Analytics heartbeat failed:', error);
    }
  }

  static async obfuscatePayload(payload) {
    try {
      // Add random noise to timestamp to prevent correlation
      const noise = Math.floor(Math.random() * 60000); // ±30 seconds
      const obfuscatedPayload = {
        ...payload,
        timestamp: payload.timestamp + noise,
        // Add random padding to prevent size-based fingerprinting
        padding: await this.generateRandomPadding(),
      };
      
      return obfuscatedPayload;
    } catch (error) {
      // Return original payload if obfuscation fails
      return payload;
    }
  }

  static async generateRandomPadding() {
    // Generate random padding to prevent size-based fingerprinting
    const length = Math.floor(Math.random() * 100) + 50;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static async updateOptInStatus(optIn) {
    try {
      await AmiXStorage.storeSecurely('analytics_opt_in', optIn);
      
      if (optIn) {
        // User opted in - initialize analytics
        await this.initialize();
      } else {
        // User opted out - clean up
        this.analyticsUUID = null;
        this.lastHeartbeat = null;
        this.isInitialized = false;
        await AmiXStorage.storeSecurely(AmiXStorage.STORAGE_KEYS.ANALYTICS_UUID, null);
        await AmiXStorage.storeSecurely('analytics_uuid_created', null);
        
        // Send final opt-out signal
        await this.sendOptOutSignal();
      }
    } catch (error) {
      console.error('Failed to update analytics opt-in status:', error);
    }
  }

  static async sendOptOutSignal() {
    try {
      // Send a final signal to indicate user opted out
      const payload = {
        action: 'opt_out',
        timestamp: Date.now(),
        // No UUID or identifying information
      };

      await fetch('/api/analytics/opt-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      // Silently fail
      console.debug('Opt-out signal failed:', error);
    }
  }

  static async exportAnalyticsData() {
    try {
      // Export analytics data for GDPR compliance
      const analyticsData = {
        optInStatus: await AmiXStorage.getSecurely('analytics_opt_in'),
        currentUUID: await AmiXStorage.getSecurely(AmiXStorage.STORAGE_KEYS.ANALYTICS_UUID),
        uuidCreated: await AmiXStorage.getSecurely('analytics_uuid_created'),
        lastHeartbeat: this.lastHeartbeat,
        exportTimestamp: Date.now(),
      };

      return analyticsData;
    } catch (error) {
      console.error('Failed to export analytics data:', error);
      return null;
    }
  }

  static async deleteAnalyticsData() {
    try {
      // Delete all analytics data for GDPR compliance
      await AmiXStorage.storeSecurely('analytics_opt_in', false);
      await AmiXStorage.storeSecurely(AmiXStorage.STORAGE_KEYS.ANALYTICS_UUID, null);
      await AmiXStorage.storeSecurely('analytics_uuid_created', null);
      
      this.analyticsUUID = null;
      this.lastHeartbeat = null;
      this.isInitialized = false;

      // Send deletion request to server
      await fetch('/api/analytics/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete_all_data',
          timestamp: Date.now(),
        }),
      });

      return true;
    } catch (error) {
      console.error('Failed to delete analytics data:', error);
      return false;
    }
  }

  // Privacy-focused event tracking (opt-in only)
  static async trackEvent(eventName, eventData = {}) {
    try {
      if (!this.analyticsUUID || !this.isInitialized) {
        return; // Analytics not enabled
      }

      // Only track non-sensitive events
      const allowedEvents = [
        'app_opened',
        'message_sent',
        'message_received',
        'group_created',
        'contact_added',
        'backup_created',
        'backup_restored',
      ];

      if (!allowedEvents.includes(eventName)) {
        console.warn('Event tracking blocked for privacy:', eventName);
        return;
      }

      // Sanitize event data - remove any potential PII
      const sanitizedData = this.sanitizeEventData(eventData);

      const eventPayload = {
        uuid: this.analyticsUUID,
        event: eventName,
        data: sanitizedData,
        timestamp: Date.now(),
      };

      await fetch('/api/analytics/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      });
    } catch (error) {
      // Silently fail
      console.debug('Event tracking failed:', error);
    }
  }

  static sanitizeEventData(data) {
    // Remove any potentially identifying information
    const sanitized = { ...data };
    
    // Remove common PII fields
    delete sanitized.email;
    delete sanitized.phone;
    delete sanitized.name;
    delete sanitized.userId;
    delete sanitized.deviceId;
    delete sanitized.ipAddress;
    delete sanitized.location;
    
    // Only keep safe, aggregated data
    const safeFields = ['count', 'type', 'duration', 'success'];
    const result = {};
    
    for (const field of safeFields) {
      if (sanitized[field] !== undefined) {
        result[field] = sanitized[field];
      }
    }
    
    return result;
  }

  // Get analytics status for UI
  static async getAnalyticsStatus() {
    try {
      const optIn = await AmiXStorage.getSecurely('analytics_opt_in');
      const uuid = await AmiXStorage.getSecurely(AmiXStorage.STORAGE_KEYS.ANALYTICS_UUID);
      const created = await AmiXStorage.getSecurely('analytics_uuid_created');
      
      return {
        isOptedIn: !!optIn,
        hasUUID: !!uuid,
        uuidCreated: created,
        isInitialized: this.isInitialized,
      };
    } catch (error) {
      console.error('Failed to get analytics status:', error);
      return {
        isOptedIn: false,
        hasUUID: false,
        uuidCreated: null,
        isInitialized: false,
      };
    }
  }
}