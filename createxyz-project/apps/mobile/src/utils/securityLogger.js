import * as SecureStore from 'expo-secure-store';
import * as AmiXCrypto from './crypto';

const SECURITY_EVENTS = {
  KEY_ROTATION: 'key_rotation',
  KEY_COMPROMISE: 'key_compromise',
  AUTH_FAILURE: 'auth_failure',
  AUTH_SUCCESS: 'auth_success',
  MESSAGE_REPLAY: 'message_replay',
  RATCHET_RESET: 'ratchet_reset',
  SECURE_STORAGE_ERROR: 'secure_storage_error',
};

const SECURITY_LOG_KEY = 'security_logs';
const MAX_LOG_ENTRIES = 1000;

export class SecurityLogger {
  // Log a security event
  static async logEvent(eventType, details = {}) {
    try {
      const timestamp = new Date().toISOString();
      const event = {
        id: await AmiXCrypto.generateSecureUUID(),
        type: eventType,
        timestamp,
        deviceId: await this.getDeviceId(),
        ...details
      };

      // Get existing logs
      const logs = await this.getLogs();
      
      // Add new event
      logs.push(event);
      
      // Keep only the most recent logs
      const recentLogs = logs.slice(-MAX_LOG_ENTRIES);
      
      // Save logs
      await SecureStore.setItemAsync(
        SECURITY_LOG_KEY,
        JSON.stringify(recentLogs)
      );
      
      return event;
    } catch (error) {
      console.error('Failed to log security event:', error);
      // Fallback to async storage if secure storage fails
      try {
        await AsyncStorage.setItem(
          `insecure_${SECURITY_LOG_KEY}_${Date.now()}`,
          JSON.stringify({ eventType, error: error.message })
        );
      } catch (e) {
        console.error('Failed to save to fallback storage:', e);
      }
    }
  }

  // Get all security logs
  static async getLogs() {
    try {
      const logs = await SecureStore.getItemAsync(SECURITY_LOG_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.error('Failed to get security logs:', error);
      return [];
    }
  }

  // Clear all security logs
  static async clearLogs() {
    try {
      await SecureStore.deleteItemAsync(SECURITY_LOG_KEY);
    } catch (error) {
      console.error('Failed to clear security logs:', error);
    }
  }

  // Get or generate a unique device ID
  static async getDeviceId() {
    try {
      let deviceId = await SecureStore.getItemAsync('device_id');
      if (!deviceId) {
        deviceId = await AmiXCrypto.generateSecureUUID();
        await SecureStore.setItemAsync('device_id', deviceId);
      }
      return deviceId;
    } catch (error) {
      console.error('Failed to get device ID:', error);
      return 'unknown-device';
    }
  }

  // Log security metrics
  static async logMetrics() {
    const logs = await this.getLogs();
    const now = new Date();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    
    const recentLogs = logs.filter(log => new Date(log.timestamp) > dayAgo);
    
    const metrics = {
      totalEvents: logs.length,
      eventsLast24h: recentLogs.length,
      byType: {},
      lastEvent: logs[logs.length - 1],
      deviceId: await this.getDeviceId(),
      timestamp: now.toISOString()
    };
    
    // Count events by type
    recentLogs.forEach(log => {
      metrics.byType[log.type] = (metrics.byType[log.type] || 0) + 1;
    });
    
    return metrics;
  }
}

// Export event types
SecurityLogger.EVENTS = SECURITY_EVENTS;

export default SecurityLogger;
