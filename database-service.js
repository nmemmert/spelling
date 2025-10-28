/**
 * Database Service Layer for Spelling Practice App
 * Provides high-level database operations and business logic
 */

const DatabaseManager = require('./database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class DatabaseService {
  constructor() {
    this.db = new DatabaseManager();
    this.jwtSecret = process.env.JWT_SECRET || 'spelling-app-secret-key';
    this.isInitialized = false;
  }

  async init() {
    await this.db.init();
    this.isInitialized = true;
    console.log('✅ Database service initialized');
  }

  // ==================== USER MANAGEMENT ====================

  async createUser(userData) {
    const { username, email, password, role = 'student', displayName } = userData;
    
    try {
      // Hash password if provided
      let passwordHash = null;
      if (password) {
        passwordHash = await bcrypt.hash(password, 10);
      }

      const result = await this.db.run(`
        INSERT INTO users (username, email, password_hash, role, display_name)
        VALUES (?, ?, ?, ?, ?)
      `, [username, email, passwordHash, role, displayName || username]);

      // Create user progress record
      await this.db.run(`
        INSERT INTO user_progress (user_id)
        VALUES (?)
      `, [result.id]);

      return { id: result.id, username, email, role, displayName };
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Username or email already exists');
      }
      throw error;
    }
  }

  async authenticateUser(username, password) {
    const user = await this.db.get(`
      SELECT id, username, email, password_hash, role, display_name, is_active
      FROM users 
      WHERE username = ? AND is_active = 1
    `, [username]);

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.password_hash) {
      // First login - set password (hash with SHA-256 first, then bcrypt)
      if (password) {
        const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
        const passwordHash = await bcrypt.hash(sha256Hash, 10);
        await this.db.run(`
          UPDATE users 
          SET password_hash = ?, last_login = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [passwordHash, user.id]);
      }
    } else {
      // Verify password - first hash with SHA-256 (as frontend does), then compare with bcrypt
      const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
      const isValid = await bcrypt.compare(sha256Hash, user.password_hash);
      if (!isValid) {
        throw new Error('Invalid password');
      }

      // Update last login
      await this.db.run(`
        UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
      `, [user.id]);
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      this.jwtSecret,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        displayName: user.display_name
      },
      token
    };
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Verify user still exists and is active
      const user = await this.db.get(`
        SELECT id, username, role, is_active 
        FROM users 
        WHERE id = ? AND is_active = 1
      `, [decoded.userId]);

      if (!user) {
        throw new Error('User not found or inactive');
      }

      return {
        id: user.id,
        username: user.username,
        role: user.role
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async updateUserPassword(username, newPassword) {
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the password in the database
    const result = await this.db.run(`
      UPDATE users 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE username = ? AND is_active = 1
    `, [hashedPassword, username]);
    
    return result.changes > 0;
  }

  async getUsers() {
    return await this.db.all(`
      SELECT id, username, email, role, display_name, created_at, last_login, is_active
      FROM users
      WHERE is_active = 1
      ORDER BY role, username
    `);
  }

  async getUserById(userId) {
    return await this.db.get(`
      SELECT id, username, email, role, display_name, created_at, last_login
      FROM users 
      WHERE id = ? AND is_active = 1
    `, [userId]);
  }

  async clearAllUsers() {
    try {
      // Clear all user-related data first to avoid foreign key constraints
      await this.db.run('DELETE FROM analytics_events');
      await this.db.run('DELETE FROM spaced_repetition');
      await this.db.run('DELETE FROM user_progress');
      await this.db.run('DELETE FROM user_badges');
      await this.db.run('DELETE FROM user_challenges');
      await this.db.run('DELETE FROM sessions');
      await this.db.run('DELETE FROM leaderboards');
      
      // Delete all users from database
      await this.db.run('DELETE FROM users');
      
      // Reset the auto-increment counters
      await this.db.run('DELETE FROM sqlite_sequence WHERE name = "users"');
      await this.db.run('DELETE FROM sqlite_sequence WHERE name = "sessions"');
      await this.db.run('DELETE FROM sqlite_sequence WHERE name = "analytics_events"');
      
      console.log('✅ All users and related data cleared from database');
      return true;
    } catch (error) {
      console.error('❌ Error clearing users:', error);
      throw error;
    }
  }

  async deleteUser(username) {
    try {
      // First, get the user ID
      const user = await this.db.get('SELECT id FROM users WHERE username = ? AND is_active = 1', [username]);
      if (!user) {
        throw new Error('User not found');
      }

      const userId = user.id;

      // Delete all user-related data first to avoid foreign key constraints
      await this.db.run('DELETE FROM analytics_events WHERE user_id = ?', [userId]);
      await this.db.run('DELETE FROM spaced_repetition WHERE user_id = ?', [userId]);
      await this.db.run('DELETE FROM user_progress WHERE user_id = ?', [userId]);
      await this.db.run('DELETE FROM user_badges WHERE user_id = ?', [userId]);
      await this.db.run('DELETE FROM user_challenges WHERE user_id = ?', [userId]);
      await this.db.run('DELETE FROM sessions WHERE user_id = ?', [userId]);
      await this.db.run('DELETE FROM leaderboards WHERE user_id = ?', [userId]);
      
      // Finally delete the user
      await this.db.run('DELETE FROM users WHERE id = ?', [userId]);
      
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // ==================== WORDLIST MANAGEMENT ====================

  async getWordlists() {
    const wordlists = await this.db.all(`
      SELECT id, name, description, difficulty_level, category, words, created_at
      FROM wordlists
      WHERE is_active = 1
      ORDER BY difficulty_level, name
    `);

    return wordlists.map(wl => ({
      ...wl,
      words: JSON.parse(wl.words || '[]')
    }));
  }

  async createWordlist(wordlistData) {
    const { name, description, difficultyLevel = 1, category, words, createdBy } = wordlistData;
    
    const result = await this.db.run(`
      INSERT INTO wordlists (name, description, difficulty_level, category, words, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [name, description, difficultyLevel, category, JSON.stringify(words), createdBy]);

    return { id: result.id, name, description, difficultyLevel, category, words };
  }

  async updateWordlist(id, wordlistData) {
    const { name, description, difficultyLevel, category, words } = wordlistData;
    
    await this.db.run(`
      UPDATE wordlists 
      SET name = ?, description = ?, difficulty_level = ?, category = ?, words = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, description, difficultyLevel, category, JSON.stringify(words), id]);

    return { id, name, description, difficultyLevel, category, words };
  }

  // ==================== SESSION MANAGEMENT ====================

  async saveSession(sessionData) {
    const { 
      userId, 
      wordlistId, 
      sessionType = 'spelling',
      score, 
      totalWords, 
      accuracy, 
      duration,
      inputMethod = 'keyboard',
      results,
      startedAt,
      completedAt
    } = sessionData;

    return await this.db.transaction(async (db) => {
      // Save session
      const sessionResult = await db.run(`
        INSERT INTO sessions (
          user_id, wordlist_id, session_type, score, total_words, 
          accuracy, duration, input_method, session_data, started_at, completed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId, wordlistId, sessionType, score, totalWords, 
        accuracy, duration, inputMethod, JSON.stringify(results),
        startedAt, completedAt || new Date().toISOString()
      ]);

      // Update user progress
      await this.updateUserProgress(userId, {
        totalSessions: 1,
        totalWords: totalWords,
        correctWords: score,
        accuracy: accuracy
      });

      // Update spaced repetition data
      if (results && results.length > 0) {
        await this.updateSpacedRepetitionData(userId, results);
      }

      return { sessionId: sessionResult.id };
    });
  }

  async getUserSessions(userId, limit = 50) {
    const sessions = await this.db.all(`
      SELECT 
        s.id,
        s.session_type,
        s.score,
        s.total_words,
        s.accuracy,
        s.duration,
        s.input_method,
        s.started_at,
        s.completed_at,
        w.name as wordlist_name
      FROM sessions s
      LEFT JOIN wordlists w ON s.wordlist_id = w.id
      WHERE s.user_id = ?
      ORDER BY s.completed_at DESC
      LIMIT ?
    `, [userId, limit]);

    return sessions;
  }

  // ==================== PROGRESS TRACKING ====================

  async updateUserProgress(userId, progressData) {
    const { totalSessions, totalWords, correctWords, accuracy } = progressData;

    // Get current progress
    let progress = await this.db.get(`
      SELECT * FROM user_progress WHERE user_id = ?
    `, [userId]);

    if (!progress) {
      // Create new progress record
      await this.db.run(`
        INSERT INTO user_progress (user_id) VALUES (?)
      `, [userId]);
      progress = { 
        total_sessions: 0, 
        total_words: 0, 
        correct_words: 0, 
        overall_accuracy: 0,
        current_streak: 0,
        longest_streak: 0,
        total_points: 0
      };
    }

    // Calculate new values
    const newTotalSessions = progress.total_sessions + (totalSessions || 0);
    const newTotalWords = progress.total_words + (totalWords || 0);
    const newCorrectWords = progress.correct_words + (correctWords || 0);
    const newOverallAccuracy = newTotalWords > 0 ? (newCorrectWords / newTotalWords) * 100 : 0;

    // Update streak
    const today = new Date().toISOString().split('T')[0];
    const lastPracticeDate = progress.last_practice_date;
    let newCurrentStreak = progress.current_streak;
    let newLongestStreak = progress.longest_streak;

    if (lastPracticeDate) {
      const daysDiff = Math.floor((new Date(today) - new Date(lastPracticeDate)) / (1000 * 60 * 60 * 24));
      if (daysDiff === 1) {
        newCurrentStreak += 1;
      } else if (daysDiff > 1) {
        newCurrentStreak = 1;
      }
    } else {
      newCurrentStreak = 1;
    }

    if (newCurrentStreak > newLongestStreak) {
      newLongestStreak = newCurrentStreak;
    }

    // Calculate points (base + accuracy bonus)
    const basePoints = totalWords * 10;
    const accuracyBonus = Math.floor(basePoints * (accuracy / 100));
    const newTotalPoints = progress.total_points + basePoints + accuracyBonus;

    // Update database
    await this.db.run(`
      UPDATE user_progress SET
        total_sessions = ?,
        total_words = ?,
        correct_words = ?,
        overall_accuracy = ?,
        current_streak = ?,
        longest_streak = ?,
        last_practice_date = ?,
        total_points = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `, [
      newTotalSessions, newTotalWords, newCorrectWords, newOverallAccuracy,
      newCurrentStreak, newLongestStreak, today, newTotalPoints, userId
    ]);

    return {
      totalSessions: newTotalSessions,
      totalWords: newTotalWords,
      correctWords: newCorrectWords,
      overallAccuracy: newOverallAccuracy,
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      totalPoints: newTotalPoints
    };
  }

  async getUserProgress(userId) {
    return await this.db.get(`
      SELECT * FROM user_progress WHERE user_id = ?
    `, [userId]);
  }

  // ==================== SPACED REPETITION ====================

  async updateSpacedRepetitionData(userId, results) {
    for (const result of results) {
      const { word, correct } = result;
      
      // Get existing spaced repetition data
      let srData = await this.db.get(`
        SELECT * FROM spaced_repetition WHERE user_id = ? AND word = ?
      `, [userId, word.toLowerCase()]);

      if (!srData) {
        // Create new spaced repetition entry
        await this.db.run(`
          INSERT INTO spaced_repetition (user_id, word, next_review_date, last_reviewed_date)
          VALUES (?, ?, date('now', '+1 day'), date('now'))
        `, [userId, word.toLowerCase()]);
      } else {
        // Update existing entry using spaced repetition algorithm
        const { difficulty, interval_days, ease_factor, repetition_count } = srData;
        
        let newDifficulty = difficulty;
        let newInterval = interval_days;
        let newEaseFactor = ease_factor;
        let newRepetitionCount = repetition_count;

        if (correct) {
          // Correct answer
          newRepetitionCount += 1;
          if (newRepetitionCount === 1) {
            newInterval = 1;
          } else if (newRepetitionCount === 2) {
            newInterval = 6;
          } else {
            newInterval = Math.round(interval_days * ease_factor);
          }
          newEaseFactor = Math.max(1.3, ease_factor + (0.1 - (5 - difficulty) * (0.08 + (5 - difficulty) * 0.02)));
        } else {
          // Incorrect answer
          newRepetitionCount = 0;
          newInterval = 1;
          newEaseFactor = Math.max(1.3, ease_factor - 0.2);
        }

        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

        await this.db.run(`
          UPDATE spaced_repetition SET
            difficulty = ?,
            interval_days = ?,
            ease_factor = ?,
            repetition_count = ?,
            next_review_date = ?,
            last_reviewed_date = date('now'),
            success_count = success_count + ?,
            failure_count = failure_count + ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND word = ?
        `, [
          newDifficulty, newInterval, newEaseFactor, newRepetitionCount,
          nextReviewDate.toISOString().split('T')[0],
          correct ? 1 : 0, correct ? 0 : 1,
          userId, word.toLowerCase()
        ]);
      }
    }
  }

  async getSpacedRepetitionWords(userId, limit = 20) {
    return await this.db.all(`
      SELECT word, difficulty, next_review_date, success_count, failure_count
      FROM spaced_repetition
      WHERE user_id = ? AND next_review_date <= date('now')
      ORDER BY next_review_date ASC, difficulty DESC
      LIMIT ?
    `, [userId, limit]);
  }

  async updateWordProgress(progressData) {
    const {
      userId,
      word,
      correctCount = 0,
      incorrectCount = 0,
      difficulty = 1.0,
      interval = 1,
      repetitions = 0,
      easeFactor = 2.5,
      lastReviewed = null,
      nextReview = null
    } = progressData;

    // Check if word progress already exists
    const existing = await this.db.get(
      'SELECT id FROM spaced_repetition WHERE user_id = ? AND word = ?',
      [userId, word]
    );

    if (existing) {
      // Update existing record
      const query = `
        UPDATE spaced_repetition 
        SET success_count = ?, failure_count = ?, difficulty = ?, 
            next_review_date = ?, updated_at = datetime('now')
        WHERE user_id = ? AND word = ?
      `;
      
      await this.db.run(query, [
        correctCount, incorrectCount, difficulty, 
        nextReview, userId, word
      ]);
      
      return existing.id;
    } else {
      // Insert new record
      const query = `
        INSERT INTO spaced_repetition (
          user_id, word, success_count, failure_count,
          difficulty, next_review_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `;
      
      const result = await this.db.run(query, [
        userId, word, correctCount, incorrectCount, difficulty, nextReview
      ]);
      
      return result.lastID;
    }
  }

  // ==================== ANALYTICS ====================

  async logAnalyticsEvent(eventData) {
    const { userId, eventType, eventData: data, sessionId, ipAddress, userAgent } = eventData;
    
    await this.db.run(`
      INSERT INTO analytics_events (user_id, event_type, event_data, session_id, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, eventType, JSON.stringify(data), sessionId, ipAddress, userAgent]);
  }

  async getAnalyticsData(filters = {}) {
    const { startDate, endDate, userId, eventType } = filters;
    
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (startDate) {
      whereClause += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND created_at <= ?';
      params.push(endDate);
    }

    if (userId) {
      whereClause += ' AND user_id = ?';
      params.push(userId);
    }

    if (eventType) {
      whereClause += ' AND event_type = ?';
      params.push(eventType);
    }

    const events = await this.db.all(`
      SELECT 
        ae.*,
        u.username
      FROM analytics_events ae
      LEFT JOIN users u ON ae.user_id = u.id
      ${whereClause}
      ORDER BY ae.created_at DESC
      LIMIT 1000
    `, params);

    return events.map(event => ({
      ...event,
      event_data: JSON.parse(event.event_data || '{}')
    }));
  }

  // ==================== CHALLENGE MANAGEMENT ====================

  async getUserChallenges(userId) {
    const userChallenges = await this.db.all(`
      SELECT c.*, uc.current_progress, uc.completed, uc.assigned_at
      FROM challenges c
      JOIN user_challenges uc ON c.id = uc.challenge_id
      WHERE uc.user_id = ? AND c.is_active = 1
      ORDER BY uc.assigned_at DESC
    `, [userId]);
    
    return userChallenges;
  }

  async assignDailyChallenge(userId) {
    try {
      // Check if user already has an active daily challenge
      const existingDaily = await this.db.get(`
        SELECT uc.id 
        FROM user_challenges uc
        JOIN challenges c ON c.id = uc.challenge_id
        WHERE uc.user_id = ? AND c.challenge_type = 'daily' 
        AND uc.completed = 0 AND DATE(uc.assigned_at) = DATE('now')
      `, [userId]);
      
      if (existingDaily) {
        return existingDaily; // Already has today's challenge
      }
      
      // Get available daily challenges
      const dailyChallenges = await this.db.all(`
        SELECT * FROM challenges 
        WHERE challenge_type = 'daily' AND is_active = 1
        ORDER BY RANDOM() LIMIT 1
      `);
      
      if (dailyChallenges.length === 0) {
        // Create default daily challenge if none exist
        await this.createDefaultChallenges();
        return await this.assignDailyChallenge(userId); // Retry
      }
      
      const challenge = dailyChallenges[0];
      
      // Assign the challenge to the user
      await this.db.run(`
        INSERT INTO user_challenges (user_id, challenge_id, current_progress, completed, assigned_at)
        VALUES (?, ?, 0, 0, datetime('now'))
      `, [userId, challenge.id]);
      
      return challenge;
    } catch (error) {
      console.error('Error assigning daily challenge:', error);
      throw error;
    }
  }

  async createDefaultChallenges() {
    const defaultChallenges = [
      {
        title: 'Daily Practice',
        description: 'Complete 5 spelling words today',
        challenge_type: 'daily',
        target_value: 5,
        reward_points: 50,
        reward_badge: null
      },
      {
        title: 'Accuracy Master',
        description: 'Achieve 80% accuracy in today\'s practice',
        challenge_type: 'daily',
        target_value: 80,
        reward_points: 75,
        reward_badge: null
      },
      {
        title: 'Speed Learner',
        description: 'Complete 10 words in under 5 minutes',
        challenge_type: 'daily',
        target_value: 10,
        reward_points: 60,
        reward_badge: null
      }
    ];
    
    for (const challenge of defaultChallenges) {
      await this.db.run(`
        INSERT OR IGNORE INTO challenges (
          title, description, challenge_type, target_value, 
          reward_points, reward_badge, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
      `, [
        challenge.title,
        challenge.description, 
        challenge.challenge_type,
        challenge.target_value,
        challenge.reward_points,
        challenge.reward_badge
      ]);
    }
  }

  async updateChallengeProgress(userId, challengeType, progress) {
    try {
      await this.db.run(`
        UPDATE user_challenges 
        SET current_progress = ?, updated_at = datetime('now')
        WHERE user_id = ? AND challenge_id IN (
          SELECT c.id FROM challenges c 
          WHERE c.challenge_type = ? AND c.is_active = 1
        ) AND completed = 0
      `, [progress, userId, challengeType]);
      
      // Check if challenge is completed
      const completedChallenges = await this.db.all(`
        SELECT uc.*, c.target_value, c.reward_points
        FROM user_challenges uc
        JOIN challenges c ON c.id = uc.challenge_id
        WHERE uc.user_id = ? AND uc.current_progress >= c.target_value 
        AND uc.completed = 0 AND c.challenge_type = ?
      `, [userId, challengeType]);
      
      // Mark completed challenges and award points
      for (const challenge of completedChallenges) {
        await this.db.run(`
          UPDATE user_challenges 
          SET completed = 1, completed_at = datetime('now')
          WHERE id = ?
        `, [challenge.id]);
        
        // Award points to user (you may want to implement a points system)
        console.log(`🎉 Challenge completed! User ${userId} earned ${challenge.reward_points} points`);
      }
      
      return completedChallenges;
    } catch (error) {
      console.error('Error updating challenge progress:', error);
      throw error;
    }
  }

  // ==================== DATA MIGRATION ====================

  async migrateFromJsonFiles() {
    const fs = require('fs').promises;
    const path = require('path');

    console.log('🔄 Starting JSON to SQLite migration...');

    try {
      // Check if migration has already been completed
      // Note: This check is disabled for now since settings table may not exist
      // const migrationCheck = await this.db.get('SELECT value FROM settings WHERE key = ?', ['migration_completed']);
      // if (migrationCheck && migrationCheck.value === 'true') {
      //   console.log('ℹ️ Migration already completed, skipping...');
      //   return;
      // }

      // Migrate users
      try {
        const usersPath = path.join(__dirname, 'data', 'users-old.json');
        const usersData = JSON.parse(await fs.readFile(usersPath, 'utf8'));
        console.log(`📥 Migrating ${usersData.length} users...`);

        for (const user of usersData) {
          try {
            // Check if user already exists
            const existingUser = await this.db.get('SELECT id FROM users WHERE username = ?', [user.username]);
            if (!existingUser) {
              // Hash password if it's not already hashed
              let passwordHash = user.password;
              if (passwordHash && !passwordHash.startsWith('$2a$') && !passwordHash.startsWith('$2b$')) {
                passwordHash = await bcrypt.hash(passwordHash, 10);
              }

              await this.db.run(`
                INSERT INTO users (username, email, password_hash, role, display_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [
                user.username,
                user.email || `${user.username}@spelling.local`,
                passwordHash,
                user.role || 'student',
                user.displayName || user.username,
                user.createdAt || new Date().toISOString()
              ]);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to migrate user ${user.username}:`, error.message);
          }
        }
      } catch (error) {
        console.warn('⚠️ Users migration failed:', error.message);
      }

      // Migrate wordlists
      try {
        const wordlistsPath = path.join(__dirname, 'data', 'wordlists.json');
        const wordlistsData = JSON.parse(await fs.readFile(wordlistsPath, 'utf8'));
        console.log(`📥 Migrating ${Object.keys(wordlistsData).length} wordlists...`);

        for (const [grade, wordlist] of Object.entries(wordlistsData)) {
          try {
            // Check if wordlist already exists
            const existingWordlist = await this.db.get('SELECT id FROM wordlists WHERE grade = ?', [grade]);
            if (!existingWordlist) {
              await this.db.run(`
                INSERT INTO wordlists (grade, words, created_at)
                VALUES (?, ?, ?)
              `, [grade, JSON.stringify(wordlist), new Date().toISOString()]);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to migrate wordlist ${grade}:`, error.message);
          }
        }
      } catch (error) {
        console.warn('⚠️ Wordlists migration failed:', error.message);
      }

      // Migrate results
      try {
        const resultsPath = path.join(__dirname, 'data', 'results.json');
        const resultsData = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
        console.log(`📥 Migrating ${resultsData.length} results...`);

        for (const result of resultsData) {
          try {
            // Get user ID
            const user = await this.db.get('SELECT id FROM users WHERE username = ?', [result.username]);
            if (user) {
              // Check if result already exists
              const existingResult = await this.db.get(`
                SELECT id FROM results 
                WHERE user_id = ? AND word = ? AND created_at = ?
              `, [user.id, result.word, result.timestamp]);

              if (!existingResult) {
                await this.db.run(`
                  INSERT INTO results (user_id, word, correct, accuracy, wpm, timestamp, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                  user.id,
                  result.word,
                  result.correct ? 1 : 0,
                  result.accuracy || 0,
                  result.wpm || 0,
                  result.timestamp,
                  result.timestamp
                ]);
              }
            }
          } catch (error) {
            console.warn(`⚠️ Failed to migrate result for ${result.username}:`, error.message);
          }
        }
      } catch (error) {
        console.warn('⚠️ Results migration failed:', error.message);
      }

      // Migrate progress
      try {
        const progressPath = path.join(__dirname, 'data', 'progress.json');
        const progressData = JSON.parse(await fs.readFile(progressPath, 'utf8'));
        console.log(`📥 Migrating progress data...`);

        for (const [username, progress] of Object.entries(progressData)) {
          try {
            const user = await this.db.get('SELECT id FROM users WHERE username = ?', [username]);
            if (user) {
              // Update user progress
              await this.db.run(`
                UPDATE user_progress 
                SET current_grade = ?, current_week = ?, total_words = ?, correct_words = ?, 
                    total_sessions = ?, last_session_date = ?, updated_at = ?
                WHERE user_id = ?
              `, [
                progress.currentGrade || '1st',
                progress.currentWeek || 1,
                progress.totalWords || 0,
                progress.correctWords || 0,
                progress.totalSessions || 0,
                progress.lastSessionDate || new Date().toISOString(),
                new Date().toISOString(),
                user.id
              ]);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to migrate progress for ${username}:`, error.message);
          }
        }
      } catch (error) {
        console.warn('⚠️ Progress migration failed:', error.message);
      }

      // Migrate spaced repetition data
      try {
        const spacedRepetitionPath = path.join(__dirname, 'data', 'spacedRepetition.json');
        const spacedRepetitionData = JSON.parse(await fs.readFile(spacedRepetitionPath, 'utf8'));
        console.log(`📥 Migrating spaced repetition data...`);

        for (const [username, data] of Object.entries(spacedRepetitionData)) {
          try {
            const user = await this.db.get('SELECT id FROM users WHERE username = ?', [username]);
            if (user) {
              for (const item of data) {
                // Check if spaced repetition item already exists
                const existingItem = await this.db.get(`
                  SELECT id FROM spaced_repetition 
                  WHERE user_id = ? AND word = ?
                `, [user.id, item.word]);

                if (!existingItem) {
                  await this.db.run(`
                    INSERT INTO spaced_repetition (user_id, word, ease_factor, interval_days, 
                                                  repetitions, next_review_date, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  `, [
                    user.id,
                    item.word,
                    item.easeFactor || 2.5,
                    item.interval || 1,
                    item.repetitions || 0,
                    item.nextReview || new Date().toISOString(),
                    item.createdAt || new Date().toISOString(),
                    new Date().toISOString()
                  ]);
                }
              }
            }
          } catch (error) {
            console.warn(`⚠️ Failed to migrate spaced repetition for ${username}:`, error.message);
          }
        }
      } catch (error) {
        console.warn('⚠️ Spaced repetition migration failed:', error.message);
      }

      // Migrate badges
      try {
        const badgesPath = path.join(__dirname, 'data', 'badges.json');
        const badgesData = JSON.parse(await fs.readFile(badgesPath, 'utf8'));
        console.log(`📥 Migrating badges data...`);

        for (const [username, badges] of Object.entries(badgesData)) {
          try {
            const user = await this.db.get('SELECT id FROM users WHERE username = ?', [username]);
            if (user) {
              for (const badge of badges) {
                // Check if badge already exists
                const existingBadge = await this.db.get(`
                  SELECT id FROM user_badges 
                  WHERE user_id = ? AND badge_type = ? AND badge_name = ?
                `, [user.id, badge.type, badge.name]);

                if (!existingBadge) {
                  await this.db.run(`
                    INSERT INTO user_badges (user_id, badge_type, badge_name, description, 
                                             earned_date, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                  `, [
                    user.id,
                    badge.type,
                    badge.name,
                    badge.description || '',
                    badge.earnedDate || new Date().toISOString(),
                    new Date().toISOString()
                  ]);
                }
              }
            }
          } catch (error) {
            console.warn(`⚠️ Failed to migrate badges for ${username}:`, error.message);
          }
        }
      } catch (error) {
        console.warn('⚠️ Badges migration failed:', error.message);
      }

      // Mark migration as completed
      // Note: Disabled for now since app_settings table exists but we're not using it
      // await this.db.run(`
      //   INSERT OR REPLACE INTO app_settings (key, value) 
      //   VALUES (?, ?)
      // `, ['migration_completed', 'true']);

      console.log('✅ JSON to SQLite migration completed successfully');

    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck() {
    return await this.db.healthCheck();
  }

  // ==================== CLEANUP ====================

  async close() {
    await this.db.close();
  }
}

module.exports = DatabaseService;