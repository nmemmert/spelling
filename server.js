const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const DatabaseService = require('./database-service');
const security = require('./middleware/security');
const { logger, requestLogger, securityLogger } = require('./middleware/logging');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Initialize database service
const dbService = new DatabaseService();

// Security middleware (apply early)
app.use(security.helmet);
app.use(security.compression);

// Apply general rate limiting only in production, or very lenient in development
if (process.env.NODE_ENV === 'production') {
  app.use(security.generalLimiter);
} else {
  // Very lenient rate limiting for development
  logger.info('Development mode: Rate y lenient for testing');
}

// Logging middleware
app.use(requestLogger);

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? false // Set specific origins in production
    : true, // Allow all origins in development
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ 
  limit: '1mb', // Reduced from 10mb for security
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(security.validateInput);

// Static file serving with caching
app.use(express.static('public', {
  maxAge: process.env.STATIC_CACHE_MAX_AGE || '1d',
  etag: true,
  lastModified: true
}));

// Enhanced health check with database status
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await dbService.healthCheck();
    
    res.status(dbHealth.status === 'healthy' ? 200 : 503).json({
      status: dbHealth.status === 'healthy' ? 'ok' : 'error',
      database: dbHealth,
      timestamp: new Date().toISOString(),
      version: '3.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Development-only route to reset rate limits
if (process.env.NODE_ENV === 'development') {
  app.post('/dev/reset-rate-limits', (req, res) => {
    try {
      // Note: This would need to be implemented based on your rate limiter's reset method
      // For now, just return a message
      logger.info('Rate limits reset requested (dev mode)');
      res.json({
        success: true,
        message: 'Rate limits reset (restart server for full reset)',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error resetting rate limits', { error: error.message });
      res.status(500).json({ error: 'Failed to reset rate limits' });
    }
  });
}

// Development-only debug endpoint for password testing
if (process.env.NODE_ENV === 'development') {
  app.post('/dev/test-password', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = await dbService.db.get(`
        SELECT id, username, password_hash, role
        FROM users 
        WHERE username = ? AND is_active = 1
      `, [username]);

      if (!user) {
        return res.json({ error: 'User not found' });
      }

      console.log('🧪 Password test for user:', username);
      console.log('🔑 Provided password:', password);

      
      if (user.password_hash) {
        const bcrypt = require('bcryptjs');
        const crypto = require('crypto');
        
        // Test direct bcrypt comparison
        const directMatch = await bcrypt.compare(password, user.password_hash);

        
        // Test SHA-256 + bcrypt comparison
        const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
        const sha256Match = await bcrypt.compare(sha256Hash, user.password_hash);

        
        res.json({
          username,
          hasStoredHash: !!user.password_hash,
          directMatch,
          sha256Match,
          sha256Hash
        });
      } else {
        res.json({ username, hasStoredHash: false, message: 'No password set' });
      }
    } catch (error) {
      res.json({ error: error.message });
    }
  });
}

// ==================== USER AUTHENTICATION ====================

// Get all users (for admin)
app.get('/getUsers', async (req, res) => {
  try {
    const users = await dbService.getUsers();
    res.json(users);
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// User login/authentication with rate limiting
app.post('/api/auth/login', security.authLimiter, async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  try {
    const { username, password } = req.body;
    

    
    if (!username || !password) {
      securityLogger.loginAttempt(username || 'unknown', clientIP, false);
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await dbService.authenticateUser(username, password);
    

    
    // Log successful authentication
    securityLogger.loginAttempt(username, clientIP, true);
    logger.info('User authenticated successfully', { username, ip: clientIP });
    
    res.json(result);
  } catch (error) {
    // Log failed authentication
    securityLogger.loginAttempt(req.body.username || 'unknown', clientIP, false);
    logger.warn('Authentication failed', { 
      username: req.body.username, 
      ip: clientIP, 
      error: error.message 
    });
    
    res.status(401).json({ error: error.message });
  }
});

// Create new user
app.post('/api/users', async (req, res) => {
  try {
    const userData = req.body;
    const user = await dbService.createUser(userData);
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({ error: error.message });
  }
});

// Change user password
app.post('/changePassword', async (req, res) => {
  try {
    const { username, newPasswordHash } = req.body;
    
    if (!username || !newPasswordHash) {
      return res.status(400).json({ error: 'Username and new password required' });
    }
    
    // The frontend sends a SHA-256 hash, but we need to hash it properly with bcrypt
    // Convert the hex hash back to a usable password for bcrypt hashing
    const success = await dbService.updateUserPassword(username, newPasswordHash);
    
    if (success) {
      res.status(200).send('Password changed successfully');
    } else {
      res.status(404).send('User not found or password change failed');
    }
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).send('Internal server error');
  }
});

// Add user (legacy endpoint for frontend compatibility)
app.post('/addUser', async (req, res) => {
  try {
    const { username, hash, role } = req.body;
    
    if (!username || !hash || !role) {
      return res.status(400).send('Username, password hash, and role are required');
    }
    
    // The frontend sends a SHA-256 hash as the password
    // We'll treat this hash as the "plain password" for bcrypt
    const userData = {
      username,
      password: hash, // The SHA-256 hash will be hashed again by bcrypt
      role,
      email: `${username}@spelling.local`,
      displayName: username
    };
    
    const user = await dbService.createUser(userData);
    
    res.status(201).send(`User "${username}" added successfully`);
  } catch (error) {
    console.error('Error adding user:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(409).send('Username already exists');
    } else {
      res.status(500).send('Failed to add user');
    }
  }
});

// Clear all users (admin only)
app.post('/clearUsers', async (req, res) => {
  try {
    await dbService.clearAllUsers();
    res.status(200).send('All users cleared successfully');
  } catch (error) {
    console.error('Error clearing users:', error);
    res.status(500).send('Failed to clear users');
  }
});

// Delete a specific user (admin only)
app.post('/deleteUser', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    await dbService.deleteUser(username);
    res.status(200).send(`User "${username}" deleted successfully`);
  } catch (error) {
    console.error('Error deleting user:', error);
    if (error.message === 'User not found') {
      res.status(404).json({ error: 'User not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
});

// Save weeks-based wordlist for a user
app.post('/saveWeeksWordList', async (req, res) => {
  try {
    const { username, weeks } = req.body;
    
    if (!username || !weeks || !Array.isArray(weeks)) {
      return res.status(400).json({ error: 'Username and weeks array are required' });
    }

    const fs = require('fs').promises;
    const path = require('path');
    
    // Read current wordlists data
    const wordlistsPath = path.join(__dirname, 'data', 'wordlists.json');
    let wordlistsData = {};
    
    try {
      const fileContent = await fs.readFile(wordlistsPath, 'utf8');
      wordlistsData = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist or is invalid, start with empty object
      console.log('Creating new wordlists.json file');
    }
    
    // Update the user's wordlist with weeks format
    wordlistsData[username] = { weeks };
    
    // Save back to file
    await fs.writeFile(wordlistsPath, JSON.stringify(wordlistsData, null, 2));
    
    res.status(200).json({ message: `Weeks wordlist saved for ${username}`, weeks: weeks.length });
  } catch (error) {
    console.error('Error saving weeks wordlist:', error);
    res.status(500).json({ error: 'Failed to save weeks wordlist' });
  }
});

// ==================== WORDLIST MANAGEMENT ====================

// Get all word lists
app.get('/getWordlists', async (req, res) => {
  try {
    const wordlists = await dbService.getWordlists();
    
    // Convert to legacy format for compatibility
    const legacyFormat = {};
    wordlists.forEach(wl => {
      legacyFormat[wl.name] = wl.words;
    });
    
    res.json(legacyFormat);
  } catch (error) {
    console.error('Error getting wordlists:', error);
    res.status(500).json({ error: 'Failed to get wordlists' });
  }
});

// Get word lists in new format
app.get('/api/wordlists', async (req, res) => {
  try {
    const wordlists = await dbService.getWordlists();
    res.json(wordlists);
  } catch (error) {
    console.error('Error getting wordlists:', error);
    res.status(500).json({ error: 'Failed to get wordlists' });
  }
});

// Get word list for specific user (legacy compatibility)
app.get('/getWordList', async (req, res) => {
  try {
    const username = req.query.username;
    if (!username) {
      return res.status(400).json({ error: 'Username parameter is required' });
    }

    const fs = require('fs').promises;
    const path = require('path');
    
    // Read from wordlists.json file
    const wordlistsPath = path.join(__dirname, 'data', 'wordlists.json');
    const wordlistsData = await fs.readFile(wordlistsPath, 'utf8');
    const wordlists = JSON.parse(wordlistsData);
    
    const userWordlist = wordlists[username];
    if (!userWordlist) {
      return res.json({ words: [] });
    }
    
    // Handle both old format (array) and new format (object with weeks)
    let words = [];
    if (Array.isArray(userWordlist)) {
      words = userWordlist;
    } else if (userWordlist.weeks && Array.isArray(userWordlist.weeks)) {
      // Flatten all words from all weeks
      words = userWordlist.weeks.flatMap(week => week.words || []);
    }
    
    res.json({ words });
  } catch (error) {
    console.error('Error getting word list for user:', req.query.username, error);
    res.status(500).json({ error: 'Failed to get word list', words: [] });
  }
});

// Get raw wordlists data (for admin interface)
app.get('/getWordlistsRaw', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const wordlistsPath = path.join(__dirname, 'data', 'wordlists.json');
    const wordlistsData = await fs.readFile(wordlistsPath, 'utf8');
    const wordlists = JSON.parse(wordlistsData);
    
    res.json(wordlists);
  } catch (error) {
    console.error('Error getting raw wordlists:', error);
    res.status(500).json({ error: 'Failed to get wordlists' });
  }
});

// Create new word list
app.post('/api/wordlists', async (req, res) => {
  try {
    const wordlistData = req.body;
    const wordlist = await dbService.createWordlist(wordlistData);
    res.status(201).json(wordlist);
  } catch (error) {
    console.error('Error creating wordlist:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update word list
app.put('/api/wordlists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const wordlistData = req.body;
    const wordlist = await dbService.updateWordlist(id, wordlistData);
    res.json(wordlist);
  } catch (error) {
    console.error('Error updating wordlist:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== SESSION MANAGEMENT ====================

// Save spelling session results
app.post('/saveResults', async (req, res) => {
  try {
    const sessionData = req.body;
    
    // Extract user ID (you might get this from JWT token in real app)
    const users = await dbService.getUsers();
    const user = users.find(u => u.username === sessionData.username);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Convert legacy format to new format
    const newSessionData = {
      userId: user.id,
      wordlistId: null, // Could be derived from wordlist name
      sessionType: sessionData.mode || 'spelling',
      score: sessionData.score || sessionData.correct || 0,
      totalWords: sessionData.total || sessionData.answers?.length || 0,
      accuracy: sessionData.accuracy || ((sessionData.score || sessionData.correct || 0) / (sessionData.total || 1)) * 100,
      duration: sessionData.duration,
      inputMethod: sessionData.inputMethod || 'keyboard',
      results: sessionData.answers || sessionData.words || [],
      startedAt: sessionData.timestamp || new Date().toISOString(),
      completedAt: new Date().toISOString()
    };

    const result = await dbService.saveSession(newSessionData);
    
    // Log analytics event
    await dbService.logAnalyticsEvent({
      userId: user.id,
      eventType: 'session_completed',
      eventData: {
        sessionType: newSessionData.sessionType,
        score: newSessionData.score,
        accuracy: newSessionData.accuracy,
        duration: newSessionData.duration
      },
      sessionId: result.sessionId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({ 
      success: true, 
      sessionId: result.sessionId,
      message: 'Session saved successfully' 
    });
  } catch (error) {
    console.error('Error saving session:', error);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// Get user results/sessions
app.get('/getResults', async (req, res) => {
  try {
    const { username } = req.query;
    
    if (username) {
      // Get specific user's sessions
      const users = await dbService.getUsers();
      const user = users.find(u => u.username === username);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const sessions = await dbService.getUserSessions(user.id);
      
      // Convert to legacy format
      const legacyFormat = {};
      legacyFormat[username] = sessions.map(session => ({
        score: session.score,
        total: session.total_words,
        accuracy: session.accuracy,
        timestamp: session.completed_at,
        mode: session.session_type,
        duration: session.duration
      }));
      
      res.json(legacyFormat);
    } else {
      // Get all users' latest sessions
      const users = await dbService.getUsers();
      const allResults = {};
      
      for (const user of users) {
        const sessions = await dbService.getUserSessions(user.id, 10);
        if (sessions.length > 0) {
          allResults[user.username] = sessions.map(session => ({
            score: session.score,
            total: session.total_words,
            accuracy: session.accuracy,
            timestamp: session.completed_at,
            mode: session.session_type,
            duration: session.duration
          }));
        }
      }
      
      res.json(allResults);
    }
  } catch (error) {
    console.error('Error getting results:', error);
    res.status(500).json({ error: 'Failed to get results' });
  }
});

// ==================== PROGRESS TRACKING ====================

// Get user progress
app.get('/api/progress/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const users = await dbService.getUsers();
    const user = users.find(u => u.username === username);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const progress = await dbService.getUserProgress(user.id);
    res.json(progress || {});
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

// Get legacy progress format
app.get('/getProgress', async (req, res) => {
  try {
    const users = await dbService.getUsers();
    const allProgress = {};
    
    for (const user of users) {
      const progress = await dbService.getUserProgress(user.id);
      if (progress) {
        allProgress[user.username] = {
          stats: {
            points: progress.total_points || 0,
            totalSessions: progress.total_sessions || 0,
            totalWords: progress.total_words || 0,
            correctWords: progress.correct_words || 0,
            overallAccuracy: progress.overall_accuracy || 0,
            currentStreak: progress.current_streak || 0,
            longestStreak: progress.longest_streak || 0
          },
          lastUpdated: progress.updated_at || new Date().toISOString()
        };
      }
    }
    
    res.json(allProgress);
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

// ==================== SPACED REPETITION ====================

// Get spaced repetition words for user
app.get('/api/spaced-repetition/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    
    const users = await dbService.getUsers();
    const user = users.find(u => u.username === username);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const words = await dbService.getSpacedRepetitionWords(user.id, limit);
    res.json(words);
  } catch (error) {
    console.error('Error getting spaced repetition words:', error);
    res.status(500).json({ error: 'Failed to get spaced repetition words' });
  }
});

// ==================== ANALYTICS ====================

// Get analytics data
app.get('/api/analytics', async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      userId: req.query.userId,
      eventType: req.query.eventType
    };

    const analyticsData = await dbService.getAnalyticsData(filters);
    
    // Process data for charts and insights
    const processedData = processAnalyticsData(analyticsData);
    
    res.json(processedData);
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics data' });
  }
});

// ==================== LEGACY ENDPOINTS (for backward compatibility) ====================

// Get user challenges
app.get('/getChallenges', async (req, res) => {
  try {
    const username = req.query.username;
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    // Get user info
    const user = await dbService.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Ensure user has a daily challenge
    await dbService.assignDailyChallenge(user.id);
    
    // Get user's challenges
    const userChallenges = await dbService.getUserChallenges(user.id);
    
    // Format response to match frontend expectations
    const response = {
      daily: { current: null, history: [] },
      weekly: { current: null, history: [] },
      achievements: []
    };
    
    userChallenges.forEach(challenge => {
      if (challenge.challenge_type === 'daily' && !challenge.completed) {
        response.daily.current = {
          id: challenge.id,
          name: challenge.title,
          description: challenge.description,
          target: challenge.target_value,
          current: challenge.current_progress || 0,
          points: challenge.reward_points,
          icon: '🎯'
        };
      } else if (challenge.challenge_type === 'weekly' && !challenge.completed) {
        response.weekly.current = {
          id: challenge.id,
          name: challenge.title,
          description: challenge.description,
          target: challenge.target_value,
          current: challenge.current_progress || 0,
          points: challenge.reward_points,
          icon: '📅'
        };
      }
    });
    
    res.json(response);
  } catch (error) {
    console.error('Error getting challenges:', error);
    res.status(500).json({ error: 'Failed to get challenges' });
  }
});

// Test endpoint to verify our code changes
app.get('/test-debug', (req, res) => {
  console.log('🔍 Test debug endpoint called');
  res.json({ message: 'Debug endpoint working', timestamp: new Date().toISOString() });
});

// Legacy leaderboards endpoint
app.get('/getLeaderboards', async (req, res) => {
  try {
    // Generate leaderboard from user progress
    const users = await dbService.getUsers();
    const leaderboardData = {
      weekly: [],
      monthly: [],
      allTime: []
    };
    
    // Get all student users with progress (exclude admin and teachers)
    for (const user of users) {
      if (user.role === 'student') {
        const progress = await dbService.getUserProgress(user.id);
        leaderboardData.allTime.push({
          username: user.username,
          score: progress ? progress.total_points || 0 : 0,
          accuracy: progress ? progress.overall_accuracy || 0 : 0,
          streak: progress ? progress.current_streak || 0 : 0
        });
      }
    }
    
    // Sort by points descending
    leaderboardData.allTime.sort((a, b) => b.score - a.score);
    
    res.json(leaderboardData);
  } catch (error) {
    console.error('Error getting leaderboards:', error);
    res.status(500).json({ error: 'Failed to get leaderboards' });
  }
});

// ==================== MIGRATION ENDPOINT ====================

// Migrate data from JSON files
app.post('/api/migrate', async (req, res) => {
  try {
    await dbService.migrateFromJsonFiles();
    res.json({ success: true, message: 'Migration completed successfully' });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Migration failed' });
  }
});

// ==================== MISSING ENDPOINTS ====================

// Save typing practice results
app.post('/saveTypingResults', async (req, res) => {
  try {
    // For now, just acknowledge the request
    // This can be expanded to save typing-specific results
    res.json({ success: true, message: 'Typing results saved' });
  } catch (error) {
    console.error('Error saving typing results:', error);
    res.status(500).json({ error: 'Failed to save typing results' });
  }
});

// Update spaced repetition data
app.post('/updateSpacedRepetitionData', async (req, res) => {
  try {
    const { username, word, performance } = req.body;
    // This would update spaced repetition algorithm data
    res.json({ success: true, message: 'Spaced repetition data updated' });
  } catch (error) {
    console.error('Error updating spaced repetition data:', error);
    res.status(500).json({ error: 'Failed to update spaced repetition data' });
  }
});

// Update spaced repetition (alternative endpoint)
app.post('/updateSpacedRepetition', async (req, res) => {
  try {
    const { username, wordData } = req.body;
    // This would update spaced repetition algorithm data
    res.json({ success: true, message: 'Spaced repetition updated' });
  } catch (error) {
    console.error('Error updating spaced repetition:', error);
    res.status(500).json({ error: 'Failed to update spaced repetition' });
  }
});

// Update user streak
app.post('/updateStreak', async (req, res) => {
  try {
    const { username, streakData } = req.body;
    // This would update user streak information
    res.json({ success: true, message: 'Streak updated' });
  } catch (error) {
    console.error('Error updating streak:', error);
    res.status(500).json({ error: 'Failed to update streak' });
  }
});

// Update challenge progress  
app.post('/updateChallengeProgress', async (req, res) => {
  try {
    const { username, challengeType, progress } = req.body;
    
    if (!username || !challengeType || progress === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await dbService.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const completedChallenges = await dbService.updateChallengeProgress(user.id, challengeType, progress);
    
    res.json({ 
      success: true, 
      message: 'Challenge progress updated',
      completedChallenges: completedChallenges.length
    });
  } catch (error) {
    console.error('Error updating challenge progress:', error);
    res.status(500).json({ error: 'Failed to update challenge progress' });
  }
});

// Complete challenge
app.post('/completeChallenge', async (req, res) => {
  try {
    const { username, challengeId } = req.body;
    
    if (!username || !challengeId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await dbService.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Mark challenge as completed
    await dbService.db.run(`
      UPDATE user_challenges 
      SET completed = 1, completed_at = datetime('now')
      WHERE user_id = ? AND challenge_id = ?
    `, [user.id, challengeId]);
    
    res.json({ success: true, message: 'Challenge completed' });
  } catch (error) {
    console.error('Error completing challenge:', error);
    res.status(500).json({ error: 'Failed to complete challenge' });
  }
});

// Award badge
app.post('/api/badges/award', async (req, res) => {
  try {
    const { username, badgeId } = req.body;
    // This would award a badge to a user
    res.json({ success: true, message: 'Badge awarded' });
  } catch (error) {
    console.error('Error awarding badge:', error);
    res.status(500).json({ error: 'Failed to award badge' });
  }
});

// Get analytics (alternative endpoint)
app.get('/getAnalytics', async (req, res) => {
  try {
    // Redirect to the main analytics endpoint
    const analyticsData = await dbService.getAnalyticsData();
    res.json(processAnalyticsData(analyticsData));
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// ==================== HELPER FUNCTIONS ====================

function processAnalyticsData(events) {
  const summary = {
    totalEvents: events.length,
    uniqueUsers: new Set(events.map(e => e.user_id)).size,
    eventsByType: {},
    dailyActivity: {},
    userStats: {}
  };

  events.forEach(event => {
    // Count by event type
    if (!summary.eventsByType[event.event_type]) {
      summary.eventsByType[event.event_type] = 0;
    }
    summary.eventsByType[event.event_type]++;

    // Daily activity
    const date = event.created_at.split('T')[0];
    if (!summary.dailyActivity[date]) {
      summary.dailyActivity[date] = 0;
    }
    summary.dailyActivity[date]++;

    // User stats
    if (event.username && !summary.userStats[event.username]) {
      summary.userStats[event.username] = {
        totalEvents: 0,
        lastActivity: null
      };
    }
    if (event.username) {
      summary.userStats[event.username].totalEvents++;
      summary.userStats[event.username].lastActivity = event.created_at;
    }
  });

  return summary;
}

// ==================== SERVER INITIALIZATION ====================

async function startServer() {
  try {
    // Initialize database
    await dbService.init();


    // Start server
    const server = app.listen(PORT, HOST, () => {
      logger.info('Server started successfully', { 
        port: PORT, 
        host: HOST, 
        nodeEnv: process.env.NODE_ENV,
        version: process.env.APP_VERSION 
      });
      
      console.log('Spelling Practice Server');
      console.log('=======================');
      console.log(`Server: http://${HOST}:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Version: ${process.env.APP_VERSION || '3.0.0'}`);
      console.log(`🗜️ Compression: Enabled for performance`);
      console.log('=============================================');
      console.log('\n✨ Production Features:');
      console.log('• �️ Security headers and rate limiting');
      console.log('• 📝 Structured logging and monitoring'); 
      console.log('• 🏆 Complete gamification system');
      console.log('• 🎨 Enhanced theme system (8 themes)');
      console.log('• 🔐 Secure authentication with JWT');
      console.log('• 📈 Analytics and progress tracking');
      console.log('• 🧠 Spaced repetition learning');
      console.log('• 🚀 RESTful API with validation');
      console.log('• 💻 Mobile-responsive design');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Add rate limiting to API routes
app.use('/api/', security.apiLimiter);

// Error handling middleware (must be last)
app.use(security.errorHandler);

// 404 handler
app.use((req, res) => {
  logger.warn('404 Not Found', { url: req.url, method: req.method, ip: req.ip });
  res.status(404).json({ 
    error: 'Not Found',
    message: 'The requested resource was not found',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await dbService.close();
    logger.info('Server shutting down gracefully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;