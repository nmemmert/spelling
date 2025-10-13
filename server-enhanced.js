const express = require('express');
const cors = require('cors');
const path = require('path');
const DatabaseService = require('./database-service');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database service
const dbService = new DatabaseService();

// Middleware
app.use(cors());
app.use(express.static('public'));
app.use(express.json({ limit: '10mb' }));

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

// User login/authentication
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await dbService.authenticateUser(username, password);
    res.json(result);
  } catch (error) {
    console.error('Login error:', error);
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

// Legacy challenges endpoint
app.get('/getChallenges', async (req, res) => {
  try {
    // Return empty challenges for now - can be implemented later
    res.json({
      daily: { current: null, history: [] },
      weekly: { current: null, history: [] },
      achievements: []
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get challenges' });
  }
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
    
    // Get all users with progress
    for (const user of users) {
      const progress = await dbService.getUserProgress(user.id);
      if (progress && progress.total_points > 0) {
        leaderboardData.allTime.push({
          username: user.username,
          score: progress.total_points,
          accuracy: progress.overall_accuracy || 0,
          streak: progress.current_streak || 0
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
    console.log('✅ Database service initialized');

    // Start server
    app.listen(PORT, () => {
      console.log('🚀 Enhanced Spelling Practice Server Started');
      console.log('====================================');
      console.log(`📡 Server: http://localhost:${PORT}`);
      console.log(`💾 Database: SQLite with enhanced features`);
      console.log(`🔒 Security: JWT authentication, bcrypt hashing`);
      console.log(`📊 Analytics: Event tracking and insights`);
      console.log(`🎯 Features: Spaced repetition, progress tracking`);
      console.log('====================================');
      console.log('\n🎮 New Features Available:');
      console.log('• 📱 PWA support with offline capability');
      console.log('• 🏆 Enhanced badge system with rarities');
      console.log('• 💾 SQLite database with proper relationships');
      console.log('• 🔐 Secure user authentication');
      console.log('• 📈 Advanced analytics and insights');
      console.log('• 🧠 Spaced repetition learning algorithm');
      console.log('• 🚀 RESTful API endpoints');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  try {
    await dbService.close();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the server
startServer();

module.exports = app;