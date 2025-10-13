/**
 * Database Manager for Spelling Practice App
 * Handles SQLite database operations with proper schema and relationships
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor() {
    this.dbPath = path.join(__dirname, 'data', 'spelling_app.db');
    this.db = null;
    this.isInitialized = false;
  }

  async init() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Connect to database
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Database connection failed:', err.message);
          throw err;
        }
        console.log('✅ Connected to SQLite database');
      });

      // Enable foreign keys
      await this.run('PRAGMA foreign_keys = ON');
      
      // Create tables
      await this.createTables();
      
      // Insert default data if needed
      await this.insertDefaultData();
      
      this.isInitialized = true;
      console.log('✅ Database initialized successfully');
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async createTables() {
    const tables = [
      // Users table with enhanced fields
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        role TEXT DEFAULT 'student',
        display_name TEXT,
        avatar_url TEXT,
        preferences TEXT, -- JSON string for user preferences
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        is_active BOOLEAN DEFAULT 1
      )`,

      // Word lists table
      `CREATE TABLE IF NOT EXISTS wordlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        difficulty_level INTEGER DEFAULT 1,
        category TEXT,
        words TEXT NOT NULL, -- JSON array of words
        created_by INTEGER,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,

      // Sessions table for practice sessions
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        wordlist_id INTEGER,
        session_type TEXT DEFAULT 'spelling', -- spelling, typing, handwriting
        score INTEGER DEFAULT 0,
        total_words INTEGER DEFAULT 0,
        accuracy REAL DEFAULT 0,
        duration INTEGER, -- in seconds
        input_method TEXT, -- keyboard, handwriting, voice
        session_data TEXT, -- JSON string with detailed results
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (wordlist_id) REFERENCES wordlists(id)
      )`,

      // User progress tracking
      `CREATE TABLE IF NOT EXISTS user_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        total_sessions INTEGER DEFAULT 0,
        total_words INTEGER DEFAULT 0,
        correct_words INTEGER DEFAULT 0,
        overall_accuracy REAL DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_practice_date DATE,
        total_points INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        experience_points INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id)
      )`,

      // Badges system
      `CREATE TABLE IF NOT EXISTS badges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        badge_key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        category TEXT,
        rarity TEXT DEFAULT 'common',
        points INTEGER DEFAULT 0,
        conditions TEXT, -- JSON string with earning conditions
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // User badges (many-to-many)
      `CREATE TABLE IF NOT EXISTS user_badges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        badge_id INTEGER NOT NULL,
        earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        progress REAL DEFAULT 100, -- percentage completion
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (badge_id) REFERENCES badges(id),
        UNIQUE(user_id, badge_id)
      )`,

      // Challenges system
      `CREATE TABLE IF NOT EXISTS challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        challenge_type TEXT, -- daily, weekly, special
        target_value INTEGER,
        reward_points INTEGER DEFAULT 0,
        reward_badge_id INTEGER,
        start_date DATE,
        end_date DATE,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reward_badge_id) REFERENCES badges(id)
      )`,

      // User challenge progress
      `CREATE TABLE IF NOT EXISTS user_challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        challenge_id INTEGER NOT NULL,
        current_progress INTEGER DEFAULT 0,
        is_completed BOOLEAN DEFAULT 0,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (challenge_id) REFERENCES challenges(id),
        UNIQUE(user_id, challenge_id)
      )`,

      // Leaderboards
      `CREATE TABLE IF NOT EXISTS leaderboards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        leaderboard_type TEXT NOT NULL, -- weekly, monthly, all_time
        user_id INTEGER NOT NULL,
        score INTEGER DEFAULT 0,
        rank INTEGER,
        period_start DATE,
        period_end DATE,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      // Spaced repetition data
      `CREATE TABLE IF NOT EXISTS spaced_repetition (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        word TEXT NOT NULL,
        difficulty REAL DEFAULT 2.5,
        interval_days INTEGER DEFAULT 1,
        repetition_count INTEGER DEFAULT 0,
        ease_factor REAL DEFAULT 2.5,
        next_review_date DATE,
        last_reviewed_date DATE,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, word)
      )`,

      // Analytics data
      `CREATE TABLE IF NOT EXISTS analytics_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        event_type TEXT NOT NULL,
        event_data TEXT, -- JSON string
        session_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      // App settings
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const tableSQL of tables) {
      await this.run(tableSQL);
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_completed_at ON sessions(completed_at)',
      'CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_spaced_repetition_user_word ON spaced_repetition(user_id, word)',
      'CREATE INDEX IF NOT EXISTS idx_spaced_repetition_next_review ON spaced_repetition(next_review_date)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at)'
    ];

    for (const indexSQL of indexes) {
      await this.run(indexSQL);
    }

    console.log('✅ Database tables and indexes created');
  }

  async insertDefaultData() {
    try {
      // Check if we have any users
      const userCount = await this.get('SELECT COUNT(*) as count FROM users');
      
      if (userCount.count === 0) {
        console.log('📝 Inserting default data...');

        // Insert default users
        const defaultUsers = [
          {
            username: 'admin',
            email: 'admin@spelling.local',
            role: 'admin',
            display_name: 'Administrator',
            password_hash: null // Will be set when user first logs in
          },
          {
            username: 'teacher',
            email: 'teacher@spelling.local', 
            role: 'teacher',
            display_name: 'Teacher',
            password_hash: null
          },
          {
            username: 'student1',
            email: 'student1@spelling.local',
            role: 'student',
            display_name: 'Student One',
            password_hash: null
          }
        ];

        for (const user of defaultUsers) {
          await this.run(`
            INSERT INTO users (username, email, role, display_name, password_hash)
            VALUES (?, ?, ?, ?, ?)
          `, [user.username, user.email, user.role, user.display_name, user.password_hash]);
        }

        // Insert default word lists
        const defaultWordlists = [
          {
            name: 'Basic Words',
            description: 'Simple words for beginners',
            difficulty_level: 1,
            category: 'basic',
            words: JSON.stringify(['cat', 'dog', 'sun', 'fun', 'run', 'big', 'red', 'blue', 'green', 'happy'])
          },
          {
            name: 'Intermediate Words', 
            description: 'Medium difficulty words',
            difficulty_level: 2,
            category: 'intermediate',
            words: JSON.stringify(['beautiful', 'rainbow', 'elephant', 'computer', 'fantastic', 'wonderful', 'amazing', 'incredible', 'fantastic', 'marvelous'])
          },
          {
            name: 'Advanced Words',
            description: 'Challenging words for advanced learners',
            difficulty_level: 3,
            category: 'advanced', 
            words: JSON.stringify(['extraordinary', 'sophisticated', 'magnificent', 'breathtaking', 'unbelievable', 'overwhelming', 'unprecedented', 'incomprehensible', 'revolutionary', 'extraordinary'])
          }
        ];

        for (const wordlist of defaultWordlists) {
          await this.run(`
            INSERT INTO wordlists (name, description, difficulty_level, category, words)
            VALUES (?, ?, ?, ?, ?)
          `, [wordlist.name, wordlist.description, wordlist.difficulty_level, wordlist.category, wordlist.words]);
        }

        // Insert default badges
        const defaultBadges = [
          {
            badge_key: 'first-word',
            name: 'First Steps',
            description: 'Spell your first word correctly',
            icon: '👶',
            category: 'milestone',
            rarity: 'common',
            points: 10
          },
          {
            badge_key: 'perfect-session',
            name: 'Perfectionist',
            description: 'Complete a session with 100% accuracy',
            icon: '💯',
            category: 'performance',
            rarity: 'uncommon',
            points: 50
          },
          {
            badge_key: 'streak-7',
            name: 'Weekly Warrior',
            description: 'Maintain a 7-day practice streak',
            icon: '🏆',
            category: 'streak',
            rarity: 'rare',
            points: 100
          }
        ];

        for (const badge of defaultBadges) {
          await this.run(`
            INSERT INTO badges (badge_key, name, description, icon, category, rarity, points)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [badge.badge_key, badge.name, badge.description, badge.icon, badge.category, badge.rarity, badge.points]);
        }

        // Insert default app settings
        const defaultSettings = [
          { key: 'app_version', value: '3.0.0', description: 'Current application version' },
          { key: 'default_session_length', value: '10', description: 'Default number of words per session' },
          { key: 'enable_analytics', value: 'true', description: 'Enable analytics tracking' },
          { key: 'maintenance_mode', value: 'false', description: 'Maintenance mode flag' }
        ];

        for (const setting of defaultSettings) {
          await this.run(`
            INSERT INTO app_settings (key, value, description)
            VALUES (?, ?, ?)
          `, [setting.key, setting.value, setting.description]);
        }

        console.log('✅ Default data inserted successfully');
      }
    } catch (error) {
      console.error('❌ Error inserting default data:', error);
      throw error;
    }
  }

  // Promisify database operations
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Database run error:', err);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, result) => {
        if (err) {
          console.error('Database get error:', err);
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Database all error:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Transaction support
  async transaction(callback) {
    return new Promise(async (resolve, reject) => {
      try {
        await this.run('BEGIN TRANSACTION');
        const result = await callback(this);
        await this.run('COMMIT');
        resolve(result);
      } catch (error) {
        await this.run('ROLLBACK');
        reject(error);
      }
    });
  }

  // Close database connection
  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Database connection closed');
          resolve();
        }
      });
    });
  }

  // Health check
  async healthCheck() {
    try {
      await this.get('SELECT 1');
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }
}

module.exports = DatabaseManager;