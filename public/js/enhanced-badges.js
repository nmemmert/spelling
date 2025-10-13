/**
 * Enhanced Badge System for Spelling Practice App
 * Includes advanced badges, achievements, and reward mechanics
 */

class EnhancedBadgeSystem {
  constructor() {
    this.badges = new Map();
    this.userBadges = new Map();
    this.achievements = new Map();
    this.streakMultipliers = new Map();
    this.init();
  }

  init() {
    this.loadBadgeDefinitions();
    this.loadAchievements();
    this.setupStreakMultipliers();
    console.log('✅ Enhanced Badge System initialized');
  }

  loadBadgeDefinitions() {
    // Basic Achievement Badges
    this.badges.set('first-word', {
      id: 'first-word',
      name: 'First Steps',
      description: 'Spell your first word correctly',
      icon: '👶',
      rarity: 'common',
      points: 10,
      category: 'milestone'
    });

    this.badges.set('perfect-session', {
      id: 'perfect-session',
      name: 'Perfectionist',
      description: 'Complete a session with 100% accuracy',
      icon: '💯',
      rarity: 'uncommon',
      points: 50,
      category: 'performance'
    });

    this.badges.set('speed-demon', {
      id: 'speed-demon',
      name: 'Speed Demon',
      description: 'Complete 10 words in under 30 seconds',
      icon: '⚡',
      rarity: 'rare',
      points: 100,
      category: 'speed'
    });

    // Streak Badges
    this.badges.set('streak-3', {
      id: 'streak-3',
      name: 'Hat Trick',
      description: 'Maintain a 3-day practice streak',
      icon: '🔥',
      rarity: 'common',
      points: 30,
      category: 'streak'
    });

    this.badges.set('streak-7', {
      id: 'streak-7',
      name: 'Weekly Warrior',
      description: 'Maintain a 7-day practice streak',
      icon: '🏆',
      rarity: 'uncommon',
      points: 100,
      category: 'streak'
    });

    this.badges.set('streak-30', {
      id: 'streak-30',
      name: 'Dedication Master',
      description: 'Maintain a 30-day practice streak',
      icon: '💎',
      rarity: 'epic',
      points: 500,
      category: 'streak'
    });

    // Volume Badges
    this.badges.set('hundred-words', {
      id: 'hundred-words',
      name: 'Centurion',
      description: 'Spell 100 words correctly',
      icon: '💪',
      rarity: 'uncommon',
      points: 75,
      category: 'volume'
    });

    this.badges.set('thousand-words', {
      id: 'thousand-words',
      name: 'Word Master',
      description: 'Spell 1,000 words correctly',
      icon: '🧙‍♂️',
      rarity: 'epic',
      points: 300,
      category: 'volume'
    });

    // Special Skill Badges
    this.badges.set('difficult-words', {
      id: 'difficult-words',
      name: 'Challenge Accepted',
      description: 'Master 20 difficult words',
      icon: '🎯',
      rarity: 'rare',
      points: 150,
      category: 'skill'
    });

    this.badges.set('handwriting-pro', {
      id: 'handwriting-pro',
      name: 'Handwriting Pro',
      description: 'Complete 50 words using handwriting input',
      icon: '✍️',
      rarity: 'rare',
      points: 125,
      category: 'skill'
    });

    // Time-based Badges
    this.badges.set('early-bird', {
      id: 'early-bird',
      name: 'Early Bird',
      description: 'Complete morning practice (6-9 AM) 5 times',
      icon: '🌅',
      rarity: 'uncommon',
      points: 60,
      category: 'time'
    });

    this.badges.set('night-owl', {
      id: 'night-owl',
      name: 'Night Owl',
      description: 'Complete evening practice (9-11 PM) 5 times',
      icon: '🦉',
      rarity: 'uncommon',
      points: 60,
      category: 'time'
    });

    // Legendary Badges
    this.badges.set('spelling-bee-champion', {
      id: 'spelling-bee-champion',
      name: 'Spelling Bee Champion',
      description: 'Win 10 multiplayer challenges',
      icon: '👑',
      rarity: 'legendary',
      points: 1000,
      category: 'competitive'
    });

    this.badges.set('word-wizard', {
      id: 'word-wizard',
      name: 'Word Wizard',
      description: 'Achieve 95%+ accuracy across 100 sessions',
      icon: '🧙‍♀️',
      rarity: 'legendary',
      points: 2000,
      category: 'mastery'
    });
  }

  loadAchievements() {
    // Progressive achievements with tiers
    this.achievements.set('accuracy-master', {
      id: 'accuracy-master',
      name: 'Accuracy Master',
      description: 'Maintain high accuracy',
      tiers: [
        { threshold: 80, badge: 'accuracy-bronze', name: 'Bronze Accuracy', icon: '🥉', points: 25 },
        { threshold: 90, badge: 'accuracy-silver', name: 'Silver Accuracy', icon: '🥈', points: 75 },
        { threshold: 95, badge: 'accuracy-gold', name: 'Gold Accuracy', icon: '🥇', points: 200 }
      ],
      category: 'performance'
    });

    this.achievements.set('session-completor', {
      id: 'session-completor',
      name: 'Session Completor',
      description: 'Complete practice sessions',
      tiers: [
        { threshold: 10, badge: 'sessions-10', name: 'Getting Started', icon: '📚', points: 20 },
        { threshold: 50, badge: 'sessions-50', name: 'Dedicated Learner', icon: '📖', points: 100 },
        { threshold: 100, badge: 'sessions-100', name: 'Study Master', icon: '🎓', points: 300 }
      ],
      category: 'volume'
    });
  }

  setupStreakMultipliers() {
    // Streak multipliers for points
    this.streakMultipliers.set(3, { multiplier: 1.1, bonus: 'Hot streak!' });
    this.streakMultipliers.set(7, { multiplier: 1.25, bonus: 'On fire!' });
    this.streakMultipliers.set(14, { multiplier: 1.5, bonus: 'Unstoppable!' });
    this.streakMultipliers.set(30, { multiplier: 2.0, bonus: 'Legendary streak!' });
  }

  // Check for new badges based on user stats
  async checkForNewBadges(username, sessionData, userStats) {
    const newBadges = [];
    
    try {
      // Check milestone badges
      if (userStats.totalWords === 1) {
        newBadges.push(await this.awardBadge(username, 'first-word'));
      }

      // Check performance badges
      if (sessionData.accuracy === 100) {
        newBadges.push(await this.awardBadge(username, 'perfect-session'));
      }

      // Check speed badges
      if (sessionData.timePerWord && sessionData.wordCount >= 10) {
        const avgTime = sessionData.timePerWord;
        if (avgTime < 3) { // Less than 3 seconds per word
          newBadges.push(await this.awardBadge(username, 'speed-demon'));
        }
      }

      // Check volume badges
      if (userStats.totalWords >= 100 && !this.hasBadge(username, 'hundred-words')) {
        newBadges.push(await this.awardBadge(username, 'hundred-words'));
      }

      if (userStats.totalWords >= 1000 && !this.hasBadge(username, 'thousand-words')) {
        newBadges.push(await this.awardBadge(username, 'thousand-words'));
      }

      // Check streak badges
      const currentStreak = userStats.currentStreak || 0;
      if (currentStreak >= 3 && !this.hasBadge(username, 'streak-3')) {
        newBadges.push(await this.awardBadge(username, 'streak-3'));
      }
      if (currentStreak >= 7 && !this.hasBadge(username, 'streak-7')) {
        newBadges.push(await this.awardBadge(username, 'streak-7'));
      }
      if (currentStreak >= 30 && !this.hasBadge(username, 'streak-30')) {
        newBadges.push(await this.awardBadge(username, 'streak-30'));
      }

      // Check time-based badges
      const hour = new Date().getHours();
      if (hour >= 6 && hour <= 9) {
        // Early bird logic would need tracking
      }

      // Check handwriting badges
      if (sessionData.inputMethod === 'handwriting') {
        // Track handwriting usage
      }

      // Check achievement tiers
      const achievementBadges = await this.checkAchievementTiers(username, userStats);
      newBadges.push(...achievementBadges);

    } catch (error) {
      console.error('Error checking for badges:', error);
    }

    return newBadges.filter(badge => badge !== null);
  }

  async checkAchievementTiers(username, userStats) {
    const newBadges = [];

    // Check accuracy achievement tiers
    const accuracyAchievement = this.achievements.get('accuracy-master');
    const overallAccuracy = userStats.overallAccuracy || 0;
    
    for (const tier of accuracyAchievement.tiers) {
      if (overallAccuracy >= tier.threshold && !this.hasBadge(username, tier.badge)) {
        const badge = {
          id: tier.badge,
          name: tier.name,
          description: `Maintain ${tier.threshold}%+ accuracy`,
          icon: tier.icon,
          points: tier.points,
          rarity: tier.threshold >= 95 ? 'epic' : tier.threshold >= 90 ? 'rare' : 'uncommon',
          category: 'achievement'
        };
        
        this.badges.set(tier.badge, badge);
        newBadges.push(await this.awardBadge(username, tier.badge));
        break; // Only award highest applicable tier
      }
    }

    // Check session completion tiers
    const sessionAchievement = this.achievements.get('session-completor');
    const totalSessions = userStats.totalSessions || 0;
    
    for (const tier of sessionAchievement.tiers) {
      if (totalSessions >= tier.threshold && !this.hasBadge(username, tier.badge)) {
        const badge = {
          id: tier.badge,
          name: tier.name,
          description: `Complete ${tier.threshold} practice sessions`,
          icon: tier.icon,
          points: tier.points,
          rarity: tier.threshold >= 100 ? 'epic' : tier.threshold >= 50 ? 'rare' : 'common',
          category: 'achievement'
        };
        
        this.badges.set(tier.badge, badge);
        newBadges.push(await this.awardBadge(username, tier.badge));
        break;
      }
    }

    return newBadges;
  }

  async awardBadge(username, badgeId) {
    if (this.hasBadge(username, badgeId)) {
      return null; // Already has badge
    }

    const badge = this.badges.get(badgeId);
    if (!badge) {
      console.error('Badge not found:', badgeId);
      return null;
    }

    // Add badge to user's collection
    if (!this.userBadges.has(username)) {
      this.userBadges.set(username, new Set());
    }
    
    this.userBadges.get(username).add(badgeId);

    // Create badge award object
    const awardedBadge = {
      ...badge,
      awardedAt: new Date().toISOString(),
      username: username
    };

    // Save to backend (would need API endpoint)
    try {
      await this.saveBadgeToBackend(username, awardedBadge);
    } catch (error) {
      console.error('Failed to save badge to backend:', error);
    }

    return awardedBadge;
  }

  hasBadge(username, badgeId) {
    return this.userBadges.has(username) && this.userBadges.get(username).has(badgeId);
  }

  getBadgesByCategory(category) {
    const badges = [];
    for (const [id, badge] of this.badges) {
      if (badge.category === category) {
        badges.push(badge);
      }
    }
    return badges;
  }

  getUserBadges(username) {
    if (!this.userBadges.has(username)) {
      return [];
    }
    
    const userBadgeIds = this.userBadges.get(username);
    const badges = [];
    
    for (const badgeId of userBadgeIds) {
      const badge = this.badges.get(badgeId);
      if (badge) {
        badges.push(badge);
      }
    }
    
    return badges.sort((a, b) => {
      const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
      return rarityOrder[b.rarity] - rarityOrder[a.rarity];
    });
  }

  calculateStreakBonus(streak, basePoints) {
    for (const [minStreak, multiplierData] of this.streakMultipliers) {
      if (streak >= minStreak) {
        const bonus = Math.floor(basePoints * (multiplierData.multiplier - 1));
        return {
          bonus: bonus,
          message: multiplierData.bonus,
          multiplier: multiplierData.multiplier
        };
      }
    }
    return { bonus: 0, message: null, multiplier: 1.0 };
  }

  async saveBadgeToBackend(username, badge) {
    // This would integrate with your backend API
    const response = await fetch('/api/badges/award', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        badge: badge
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save badge to backend');
    }

    return await response.json();
  }

  // Display badge notification
  showBadgeNotification(badges) {
    if (!badges || badges.length === 0) return;

    badges.forEach((badge, index) => {
      setTimeout(() => {
        this.createBadgeNotification(badge);
      }, index * 1000); // Stagger notifications
    });
  }

  createBadgeNotification(badge) {
    const notification = document.createElement('div');
    notification.className = 'badge-notification';
    
    const rarityClass = `rarity-${badge.rarity}`;
    notification.classList.add(rarityClass);
    
    notification.innerHTML = `
      <div class="badge-notification-content">
        <div class="badge-icon">${badge.icon}</div>
        <div class="badge-info">
          <div class="badge-title">Badge Earned!</div>
          <div class="badge-name">${badge.name}</div>
          <div class="badge-description">${badge.description}</div>
          <div class="badge-points">+${badge.points} points</div>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.classList.add('hide');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, 5000);

    // Add click to dismiss
    notification.addEventListener('click', () => {
      notification.classList.add('hide');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    });
  }
}

// Initialize enhanced badge system
document.addEventListener('DOMContentLoaded', () => {
  window.enhancedBadgeSystem = new EnhancedBadgeSystem();
});

// Export for use in other modules
window.EnhancedBadgeSystem = EnhancedBadgeSystem;