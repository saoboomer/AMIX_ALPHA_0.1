import { AmiXStorage } from './storage';
import { AmiXCrypto } from './crypto';
import { AmiXAnalytics } from './analytics';

// AmiX Gamification System - Local-only implementation
// Provides points, themes, achievements, and rewards while maintaining privacy

export class AmiXGamification {
  static POINTS_MULTIPLIER = 1;
  static MAX_DAILY_POINTS = 1000;
  static ACHIEVEMENT_CHECK_INTERVAL = 60000; // 1 minute

  // Points for different actions
  static POINTS_REWARDS = {
    MESSAGE_SENT: 5,
    MESSAGE_RECEIVED: 2,
    FILE_SHARED: 10,
    CALL_COMPLETED: 25,
    GROUP_CREATED: 50,
    SAFETY_VERIFIED: 15,
    BACKUP_CREATED: 20,
    STREAK_MAINTAINED: 10,
    DAILY_LOGIN: 5,
    PRIVACY_SETTING_CHANGED: 3,
  };

  // Achievement definitions
  static ACHIEVEMENTS = {
    FIRST_MESSAGE: {
      id: 'first_message',
      title: 'First Steps',
      description: 'Send your first message',
      points: 50,
      icon: '💬',
      condition: (stats) => stats.messagesSent >= 1,
    },
    MESSAGE_MASTER: {
      id: 'message_master',
      title: 'Message Master',
      description: 'Send 100 messages',
      points: 200,
      icon: '📱',
      condition: (stats) => stats.messagesSent >= 100,
    },
    FILE_SHARER: {
      id: 'file_sharer',
      title: 'File Sharer',
      description: 'Share your first file',
      points: 75,
      icon: '📎',
      condition: (stats) => stats.filesShared >= 1,
    },
    CALLER: {
      id: 'caller',
      title: 'Voice Communicator',
      description: 'Complete your first call',
      points: 100,
      icon: '📞',
      condition: (stats) => stats.callsCompleted >= 1,
    },
    GROUP_LEADER: {
      id: 'group_leader',
      title: 'Group Leader',
      description: 'Create your first group',
      points: 150,
      icon: '👥',
      condition: (stats) => stats.groupsCreated >= 1,
    },
    PRIVACY_CHAMPION: {
      id: 'privacy_champion',
      title: 'Privacy Champion',
      description: 'Verify 10 safety numbers',
      points: 300,
      icon: '🔒',
      condition: (stats) => stats.safetyVerifications >= 10,
    },
    STREAK_MASTER: {
      id: 'streak_master',
      title: 'Streak Master',
      description: 'Maintain a 7-day login streak',
      points: 250,
      icon: '🔥',
      condition: (stats) => stats.currentStreak >= 7,
    },
    BACKUP_BOSS: {
      id: 'backup_boss',
      title: 'Backup Boss',
      description: 'Create your first backup',
      points: 100,
      icon: '💾',
      condition: (stats) => stats.backupsCreated >= 1,
    },
    DAILY_USER: {
      id: 'daily_user',
      title: 'Daily User',
      description: 'Log in for 30 consecutive days',
      points: 500,
      icon: '📅',
      condition: (stats) => stats.currentStreak >= 30,
    },
    SECURITY_EXPERT: {
      id: 'security_expert',
      title: 'Security Expert',
      description: 'Change all privacy settings',
      points: 200,
      icon: '🛡️',
      condition: (stats) => stats.privacySettingsChanged >= 5,
    },
  };

  // Theme definitions
  static THEMES = {
    DEFAULT: {
      id: 'default',
      name: 'Classic Cream',
      description: 'The original AmiX theme',
      unlocked: true,
      colors: {
        primary: '#F5E6D3',
        secondary: '#E8D5B7',
        accent: '#D4AF37',
        text: '#2C1810',
        background: '#FDFBF7',
      },
    },
    DARK_MODE: {
      id: 'dark_mode',
      name: 'Night Owl',
      description: 'Dark theme for night usage',
      unlocked: true,
      colors: {
        primary: '#2C2C2C',
        secondary: '#3A3A3A',
        accent: '#D4AF37',
        text: '#F5F5F5',
        background: '#1A1A1A',
      },
    },
    GOLDEN: {
      id: 'golden',
      name: 'Golden Hour',
      description: 'Premium golden theme',
      unlocked: false,
      requiredPoints: 1000,
      colors: {
        primary: '#FFD700',
        secondary: '#FFA500',
        accent: '#FF8C00',
        text: '#2C1810',
        background: '#FFF8DC',
      },
    },
    OCEAN: {
      id: 'ocean',
      name: 'Ocean Blue',
      description: 'Calming ocean theme',
      unlocked: false,
      requiredPoints: 500,
      colors: {
        primary: '#87CEEB',
        secondary: '#4682B4',
        accent: '#1E90FF',
        text: '#FFFFFF',
        background: '#F0F8FF',
      },
    },
    FOREST: {
      id: 'forest',
      name: 'Forest Green',
      description: 'Nature-inspired theme',
      unlocked: false,
      requiredPoints: 750,
      colors: {
        primary: '#90EE90',
        secondary: '#228B22',
        accent: '#32CD32',
        text: '#FFFFFF',
        background: '#F0FFF0',
      },
    },
    SUNSET: {
      id: 'sunset',
      name: 'Sunset Glow',
      description: 'Warm sunset colors',
      unlocked: false,
      requiredPoints: 1500,
      colors: {
        primary: '#FF6B6B',
        secondary: '#FF8E53',
        accent: '#FFA07A',
        text: '#FFFFFF',
        background: '#FFF5EE',
      },
    },
  };

  // Reaction packs
  static REACTION_PACKS = {
    BASIC: {
      id: 'basic',
      name: 'Basic Reactions',
      description: 'Standard reaction pack',
      unlocked: true,
      reactions: ['👍', '👎', '❤️', '😂', '😮', '😢', '😡'],
    },
    ANIMALS: {
      id: 'animals',
      name: 'Animal Friends',
      description: 'Cute animal reactions',
      unlocked: false,
      requiredPoints: 300,
      reactions: ['🐶', '🐱', '🐰', '🐼', '🦊', '🐸', '🐨'],
    },
    FOOD: {
      id: 'food',
      name: 'Food Lover',
      description: 'Delicious food reactions',
      unlocked: false,
      requiredPoints: 400,
      reactions: ['🍕', '🍔', '🍦', '🍩', '🍰', '🍺', '☕'],
    },
    SPACE: {
      id: 'space',
      name: 'Space Explorer',
      description: 'Out of this world reactions',
      unlocked: false,
      requiredPoints: 600,
      reactions: ['🚀', '⭐', '🌙', '🌍', '👾', '🛸', '💫'],
    },
  };

  static async initialize() {
    try {
      // Initialize user stats if not exists
      await this.initializeUserStats();
      
      // Check for achievements periodically
      setInterval(() => {
        this.checkAchievements();
      }, this.ACHIEVEMENT_CHECK_INTERVAL);

      // Daily login bonus
      await this.checkDailyLogin();

      return true;
    } catch (error) {
      console.error('Gamification initialization failed:', error);
      return false;
    }
  }

  // Initialize user statistics
  static async initializeUserStats() {
    try {
      const stats = await AmiXStorage.get('user_stats');
      if (!stats) {
        const initialStats = {
          points: 0,
          totalPoints: 0,
          level: 1,
          messagesSent: 0,
          messagesReceived: 0,
          filesShared: 0,
          callsCompleted: 0,
          groupsCreated: 0,
          safetyVerifications: 0,
          backupsCreated: 0,
          privacySettingsChanged: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastLoginDate: null,
          achievements: [],
          unlockedThemes: ['default', 'dark_mode'],
          unlockedReactionPacks: ['basic'],
          currentTheme: 'default',
          currentReactionPack: 'basic',
          createdAt: Date.now(),
        };

        await AmiXStorage.store('user_stats', initialStats);
      }
    } catch (error) {
      console.error('Failed to initialize user stats:', error);
    }
  }

  // Award points for actions
  static async awardPoints(action, amount = null) {
    try {
      const stats = await AmiXStorage.get('user_stats');
      if (!stats) return;

      const pointsToAward = amount || this.POINTS_REWARDS[action] || 0;
      
      // Check daily limit
      const today = new Date().toDateString();
      const dailyPoints = stats.dailyPoints || {};
      const todayPoints = dailyPoints[today] || 0;
      
      if (todayPoints + pointsToAward > this.MAX_DAILY_POINTS) {
        pointsToAward = Math.max(0, this.MAX_DAILY_POINTS - todayPoints);
      }

      if (pointsToAward > 0) {
        stats.points += pointsToAward;
        stats.totalPoints += pointsToAward;
        stats.dailyPoints = { ...dailyPoints, [today]: todayPoints + pointsToAward };

        // Update level
        const newLevel = Math.floor(stats.totalPoints / 100) + 1;
        if (newLevel > stats.level) {
          stats.level = newLevel;
          await this.onLevelUp(newLevel);
        }

        await AmiXStorage.store('user_stats', stats);
        await this.checkUnlockables();
      }
    } catch (error) {
      console.error('Failed to award points:', error);
    }
  }

  // Update statistics for specific actions
  static async updateStats(action, increment = 1) {
    try {
      const stats = await AmiXStorage.get('user_stats');
      if (!stats) return;

      if (stats[action] !== undefined) {
        stats[action] += increment;
        await AmiXStorage.store('user_stats', stats);
        
        // Award points for the action
        await this.awardPoints(action);
        
        // Check achievements
        await this.checkAchievements();
      }
    } catch (error) {
      console.error('Failed to update stats:', error);
    }
  }

  // Check and unlock achievements
  static async checkAchievements() {
    try {
      const stats = await AmiXStorage.get('user_stats');
      if (!stats) return;

      const unlockedAchievements = new Set(stats.achievements);
      const newAchievements = [];

      for (const [key, achievement] of Object.entries(this.ACHIEVEMENTS)) {
        if (!unlockedAchievements.has(achievement.id) && achievement.condition(stats)) {
          newAchievements.push(achievement);
          unlockedAchievements.add(achievement.id);
          
          // Award achievement points
          await this.awardPoints('ACHIEVEMENT', achievement.points);
        }
      }

      if (newAchievements.length > 0) {
        stats.achievements = Array.from(unlockedAchievements);
        await AmiXStorage.store('user_stats', stats);
        
        // Notify user of new achievements
        await this.notifyAchievements(newAchievements);
      }
    } catch (error) {
      console.error('Failed to check achievements:', error);
    }
  }

  // Check unlockables (themes, reaction packs)
  static async checkUnlockables() {
    try {
      const stats = await AmiXStorage.get('user_stats');
      if (!stats) return;

      // Check theme unlocks
      for (const [key, theme] of Object.entries(this.THEMES)) {
        if (!theme.unlocked && !stats.unlockedThemes.includes(theme.id)) {
          if (stats.points >= (theme.requiredPoints || 0)) {
            stats.unlockedThemes.push(theme.id);
            await this.notifyThemeUnlock(theme);
          }
        }
      }

      // Check reaction pack unlocks
      for (const [key, pack] of Object.entries(this.REACTION_PACKS)) {
        if (!pack.unlocked && !stats.unlockedReactionPacks.includes(pack.id)) {
          if (stats.points >= (pack.requiredPoints || 0)) {
            stats.unlockedReactionPacks.push(pack.id);
            await this.notifyReactionPackUnlock(pack);
          }
        }
      }

      await AmiXStorage.store('user_stats', stats);
    } catch (error) {
      console.error('Failed to check unlockables:', error);
    }
  }

  // Daily login bonus
  static async checkDailyLogin() {
    try {
      const stats = await AmiXStorage.get('user_stats');
      if (!stats) return;

      const today = new Date().toDateString();
      const lastLogin = stats.lastLoginDate;

      if (lastLogin !== today) {
        // Award daily login bonus
        await this.awardPoints('DAILY_LOGIN');

        // Update streak
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = yesterday.toDateString();

        if (lastLogin === yesterdayString) {
          stats.currentStreak += 1;
        } else if (lastLogin !== today) {
          stats.currentStreak = 1;
        }

        if (stats.currentStreak > stats.longestStreak) {
          stats.longestStreak = stats.currentStreak;
        }

        stats.lastLoginDate = today;
        await AmiXStorage.store('user_stats', stats);

        // Check streak achievements
        if (stats.currentStreak % 7 === 0) {
          await this.awardPoints('STREAK_MAINTAINED');
        }
      }
    } catch (error) {
      console.error('Failed to check daily login:', error);
    }
  }

  // Level up notification
  static async onLevelUp(newLevel) {
    try {
      // Track analytics
      await AmiXAnalytics.trackEvent('level_up', {
        level: newLevel,
      });

      // Could show a level up notification here
      console.log(`🎉 Level up! You're now level ${newLevel}`);
    } catch (error) {
      console.error('Failed to handle level up:', error);
    }
  }

  // Achievement notification
  static async notifyAchievements(achievements) {
    try {
      for (const achievement of achievements) {
        // Track analytics
        await AmiXAnalytics.trackEvent('achievement_unlocked', {
          achievementId: achievement.id,
          points: achievement.points,
        });

        // Could show achievement notification here
        console.log(`🏆 Achievement unlocked: ${achievement.title} - ${achievement.description}`);
      }
    } catch (error) {
      console.error('Failed to notify achievements:', error);
    }
  }

  // Theme unlock notification
  static async notifyThemeUnlock(theme) {
    try {
      await AmiXAnalytics.trackEvent('theme_unlocked', {
        themeId: theme.id,
        requiredPoints: theme.requiredPoints,
      });

      console.log(`🎨 New theme unlocked: ${theme.name}`);
    } catch (error) {
      console.error('Failed to notify theme unlock:', error);
    }
  }

  // Reaction pack unlock notification
  static async notifyReactionPackUnlock(pack) {
    try {
      await AmiXAnalytics.trackEvent('reaction_pack_unlocked', {
        packId: pack.id,
        requiredPoints: pack.requiredPoints,
      });

      console.log(`😊 New reaction pack unlocked: ${pack.name}`);
    } catch (error) {
      console.error('Failed to notify reaction pack unlock:', error);
    }
  }

  // Get user statistics
  static async getUserStats() {
    try {
      const stats = await AmiXStorage.get('user_stats');
      return stats || {};
    } catch (error) {
      console.error('Failed to get user stats:', error);
      return {};
    }
  }

  // Get available themes
  static async getAvailableThemes() {
    try {
      const stats = await AmiXStorage.get('user_stats');
      const unlockedThemes = stats?.unlockedThemes || ['default'];

      return Object.values(this.THEMES).map(theme => ({
        ...theme,
        unlocked: unlockedThemes.includes(theme.id),
      }));
    } catch (error) {
      console.error('Failed to get available themes:', error);
      return [];
    }
  }

  // Get available reaction packs
  static async getAvailableReactionPacks() {
    try {
      const stats = await AmiXStorage.get('user_stats');
      const unlockedPacks = stats?.unlockedReactionPacks || ['basic'];

      return Object.values(this.REACTION_PACKS).map(pack => ({
        ...pack,
        unlocked: unlockedPacks.includes(pack.id),
      }));
    } catch (error) {
      console.error('Failed to get available reaction packs:', error);
      return [];
    }
  }

  // Set current theme
  static async setCurrentTheme(themeId) {
    try {
      const stats = await AmiXStorage.get('user_stats');
      if (stats && stats.unlockedThemes.includes(themeId)) {
        stats.currentTheme = themeId;
        await AmiXStorage.store('user_stats', stats);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to set current theme:', error);
      return false;
    }
  }

  // Set current reaction pack
  static async setCurrentReactionPack(packId) {
    try {
      const stats = await AmiXStorage.get('user_stats');
      if (stats && stats.unlockedReactionPacks.includes(packId)) {
        stats.currentReactionPack = packId;
        await AmiXStorage.store('user_stats', stats);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to set current reaction pack:', error);
      return false;
    }
  }

  // Get current theme colors
  static async getCurrentThemeColors() {
    try {
      const stats = await AmiXStorage.get('user_stats');
      const currentThemeId = stats?.currentTheme || 'default';
      return this.THEMES[currentThemeId]?.colors || this.THEMES.DEFAULT.colors;
    } catch (error) {
      console.error('Failed to get current theme colors:', error);
      return this.THEMES.DEFAULT.colors;
    }
  }

  // Get current reaction pack
  static async getCurrentReactionPack() {
    try {
      const stats = await AmiXStorage.get('user_stats');
      const currentPackId = stats?.currentReactionPack || 'basic';
      return this.REACTION_PACKS[currentPackId] || this.REACTION_PACKS.BASIC;
    } catch (error) {
      console.error('Failed to get current reaction pack:', error);
      return this.REACTION_PACKS.BASIC;
    }
  }

  // Reset all progress (for testing or user request)
  static async resetProgress() {
    try {
      await AmiXStorage.delete('user_stats');
      await this.initializeUserStats();
      console.log('Progress reset successfully');
    } catch (error) {
      console.error('Failed to reset progress:', error);
    }
  }

  // Export user data (for GDPR compliance)
  static async exportUserData() {
    try {
      const stats = await AmiXStorage.get('user_stats');
      return {
        gamification: {
          stats,
          achievements: this.ACHIEVEMENTS,
          themes: this.THEMES,
          reactionPacks: this.REACTION_PACKS,
        },
        exportedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to export user data:', error);
      return null;
    }
  }
}
