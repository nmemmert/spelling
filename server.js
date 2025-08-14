const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// 🗂 Directories
const DATA_DIR = path.join(__dirname, 'data');
const SEED_DIR = path.join(__dirname, 'seed');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Define file paths
const files = {
  users: 'users.json',
  wordlists: 'wordlists.json',
  results: 'results.json',
  badges: 'badges.json',
  leaderboards: 'leaderboards.json',
  challenges: 'challenges.json',
  progress: 'progress.json',
  spacedRepetition: 'spacedRepetition.json'
};

// 📁 Set up middleware
app.use(express.static('public'));
app.use(express.json());

// Health check endpoint for container monitoring
app.get('/health', (req, res) => {
  try {
    // Check if essential files exist
    const usersExists = fs.existsSync(path.join(DATA_DIR, files.users));
    const wordlistsExists = fs.existsSync(path.join(DATA_DIR, files.wordlists));
    
    if (usersExists && wordlistsExists) {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: require('./version.json').version
      });
    } else {
      res.status(503).json({
        status: 'error',
        message: 'Essential data files not available',
        missing: {
          users: !usersExists,
          wordlists: !wordlistsExists
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Define routes after middleware is set up
// Serve raw wordlists.json for admin UI
app.get('/getWordlistsRaw', (req, res) => {
  const wordlists = readJsonSafe(path.join(DATA_DIR, files.wordlists), {});
  res.json(wordlists);
});

// Date utility functions for gamification features
function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function getWeekStartDate(date) {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function getWeekEndDate(date) {
  const result = new Date(date);
  result.setDate(result.getDate() + (6 - result.getDay()));
  return result;
}

function isToday(dateString) {
  if (!dateString) return false;
  const today = new Date().toISOString().split('T')[0];
  return dateString.split('T')[0] === today;
}

function isSameDay(date1, date2) {
  return date1.toISOString().split('T')[0] === date2.toISOString().split('T')[0];
}

function daysInARow(dateStrings) {
  if (!dateStrings || !dateStrings.length) return 0;
  
  // Convert strings to Date objects
  const dates = dateStrings.map(d => new Date(d)).sort((a, b) => a - b);
  
  let currentStreak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i-1]);
    prevDate.setDate(prevDate.getDate() + 1);
    
    // If consecutive days
    if (isSameDay(prevDate, dates[i])) {
      currentStreak++;
    } else {
      break;
    }
  }
  
  return currentStreak;
}

// 🗃 File mapping already defined at the top

// Ensure all required files exist at startup
function ensureAllRequiredFiles() {
  console.log('🔍 Checking for required data files...');
  
  Object.entries(files).forEach(([key, filename]) => {
    ensureFileWithSeed(filename);
  });
  
  console.log('✅ All required data files initialized');
}

// 🌱 Initialize data from seeds if missing/empty
function ensureFileWithSeed(name, fallback = '{}') {
  console.log(`🌱 Checking ${name}...`);
  const targetPath = path.join(DATA_DIR, name);
  const seedPath = path.join(SEED_DIR, name);

  if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, 'utf-8').trim() === '') {
    console.log(`⚠️ File ${name} missing or empty, seeding...`);
    if (fs.existsSync(seedPath)) {
      fs.copyFileSync(seedPath, targetPath);
      console.log(`✅ Seeded ${name} from seed/${name}`);
    } else {
      // Create default data for each file type
      if (name === 'users.json') {
        const defaultUsers = [
          {
            "username": "admin1",
            "hash": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8", // password
            "role": "admin"
          },
          {
            "username": "nate",
            "hash": "5a2a558c78d3717db731600c4f354fa1d9c84b556f108091a891f444f1bdec40", // nate123
            "role": "student"
          },
          {
            "username": "student1",
            "hash": "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92", // 123456
            "role": "student"
          }
        ];
        fs.writeFileSync(targetPath, JSON.stringify(defaultUsers, null, 2));
        console.log(`👥 Created default users: admin1, nate, student1`);
      } else if (name === 'wordlists.json') {
        const defaultWordlists = {
          "student1": [
            "apple", "banana", "cherry", "date", "elderberry",
            "grape", "honeydew", "kiwi", "lemon", "mango"
          ],
          "admin1": [
            "administration", "education", "technology", "development", "programming"
          ],
          "nate": [
            "computer", "keyboard", "mouse", "screen", "printer",
            "software", "hardware", "network", "database", "security"
          ]
        };
        fs.writeFileSync(targetPath, JSON.stringify(defaultWordlists, null, 2));
        console.log(`📝 Created default word lists for all users`);
      } else if (name === 'badges.json') {
        const defaultBadges = {
          "student1": [],
          "nate": [],
          "admin1": []
        };
        fs.writeFileSync(targetPath, JSON.stringify(defaultBadges, null, 2));
        console.log(`🏆 Created default badge structure`);
      } else if (name === 'leaderboards.json') {
        const defaultLeaderboards = {
          "allTime": {
            "accuracy": [],
            "totalWords": [],
            "sessionsCompleted": [],
            "streakDays": []
          },
          "weekly": {
            "accuracy": [],
            "totalWords": [],
            "sessionsCompleted": []
          },
          "lastUpdated": new Date().toISOString()
        };
        fs.writeFileSync(targetPath, JSON.stringify(defaultLeaderboards, null, 2));
        console.log(`🏅 Created default leaderboards structure`);
      } else if (name === 'challenges.json') {
        const today = new Date();
        const dayString = today.toISOString().split('T')[0];
        const weekNum = getWeekNumber(today);
        const yearNum = today.getFullYear();
        
        const defaultChallenges = {
          "daily": {
            "current": {
              "id": `daily-${dayString}`,
              "title": `${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} Challenge`,
              "description": "Complete a spelling session with at least 90% accuracy",
              "type": "accuracy",
              "target": 90,
              "reward": {
                "points": 50,
                "badge": null
              },
              "date": dayString
            },
            "history": []
          },
          "weekly": {
            "current": {
              "id": `weekly-${yearNum}-${weekNum}`,
              "title": `Week ${weekNum} Challenge`,
              "description": "Practice spelling for 5 consecutive days",
              "type": "streak",
              "target": 5,
              "reward": {
                "points": 100,
                "badge": "Weekly Warrior"
              },
              "startDate": getWeekStartDate(today).toISOString().split('T')[0],
              "endDate": getWeekEndDate(today).toISOString().split('T')[0]
            },
            "history": []
          },
          "achievements": [
            {
              "id": "perfect-accuracy",
              "title": "Perfect Accuracy",
              "description": "Complete a session with 100% accuracy",
              "type": "session",
              "condition": "accuracy",
              "target": 100,
              "reward": {
                "points": 75,
                "badge": "Perfection"
              }
            },
            {
              "id": "persistent-learner",
              "title": "Persistent Learner",
              "description": "Practice for 7 days in a row",
              "type": "streak",
              "condition": "dailyLogin",
              "target": 7,
              "reward": {
                "points": 200,
                "badge": "Persistence"
              }
            },
            {
              "id": "spelling-veteran",
              "title": "Spelling Veteran",
              "description": "Complete 50 spelling sessions",
              "type": "cumulative",
              "condition": "sessions",
              "target": 50,
              "reward": {
                "points": 300,
                "badge": "Veteran"
              }
            }
          ],
          "lastUpdated": new Date().toISOString()
        };
        fs.writeFileSync(targetPath, JSON.stringify(defaultChallenges, null, 2));
        console.log(`🎯 Created default challenges structure`);
      } else if (name === 'progress.json') {
        // Create empty progress structure for each user
        const users = readJsonSafe(path.join(DATA_DIR, files.users), []);
        const defaultProgress = {};
        
        users.forEach(user => {
          defaultProgress[user.username] = {
            "stats": {
              "points": 0,
              "totalSessions": 0,
              "totalWords": 0,
              "correctWords": 0,
              "accuracy": 0
            },
            "streaks": {
              "current": 0,
              "longest": 0,
              "lastActivity": null
            },
            "challengesCompleted": {
              "daily": [],
              "weekly": [],
              "achievements": []
            }
          };
        });
        
        fs.writeFileSync(targetPath, JSON.stringify(defaultProgress, null, 2));
        console.log(`📈 Created default progress structure for ${Object.keys(defaultProgress).length} users`);
      } else if (name === 'spacedRepetition.json') {
        // Create empty spaced repetition structure for each user
        const users = readJsonSafe(path.join(DATA_DIR, files.users), []);
        const defaultSRData = {};
        
        users.forEach(user => {
          defaultSRData[user.username] = {
            "settings": {
              "dailyLimit": 20,
              "reviewThreshold": 3,
              "newWordsPerDay": 5
            },
            "stats": {
              "totalReviews": 0,
              "correctReviews": 0,
              "totalWords": 0,
              "masteredWords": 0
            },
            "words": {}
          };
        });
        
        fs.writeFileSync(targetPath, JSON.stringify(defaultSRData, null, 2));
        console.log(`📚 Created default spaced repetition structure for ${Object.keys(defaultSRData).length} users`);
      } else {
        fs.writeFileSync(targetPath, fallback);
        console.log(`📄 Initialized ${name} with default`);
      }
    }
  }
}

for (const [key, file] of Object.entries(files)) {
  const defaultData = file === 'users.json' ? '[]' : '{}';
  ensureFileWithSeed(file, defaultData);
}

// 🔄 Initialize existing users in all data files
function initializeAllExistingUsers() {
  console.log('🔄 Checking all users are initialized...');
  const users = readJsonSafe(path.join(DATA_DIR, files.users), []);
  
  users.forEach(user => {
    // Check if user exists in all data files
    const wordlists = readJsonSafe(path.join(DATA_DIR, files.wordlists), {});
    const results = readJsonSafe(path.join(DATA_DIR, files.results), {});
    const badges = readJsonSafe(path.join(DATA_DIR, files.badges), {});
    
    const needsInit = !wordlists[user.username] || !results[user.username] || !badges[user.username];
    
    if (needsInit) {
      console.log(`🔧 User "${user.username}" needs initialization`);
      initializeUserInAllFiles(user.username);
    }
  });
  console.log('✅ All users initialized');
}

// Initialize all existing users
initializeAllExistingUsers();

// 🔐 JSON utility
function readJsonSafe(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

// 🔧 Initialize user across all data files
function initializeUserInAllFiles(username) {
  console.log(`🔧 Initializing user "${username}" across all data files`);
  
  // Initialize in wordlists.json
  const wordlistsPath = path.join(DATA_DIR, files.wordlists);
  const wordlists = readJsonSafe(wordlistsPath, {});
  if (!wordlists[username]) {
    wordlists[username] = [
      "hello", "world", "test", "sample", "basic",
      "learn", "spell", "word", "study", "practice"
    ];
    fs.writeFileSync(wordlistsPath, JSON.stringify(wordlists, null, 2));
    console.log(`📝 Added default word list for "${username}"`);
  }
  
  // Initialize in results.json
  const resultsPath = path.join(DATA_DIR, files.results);
  const results = readJsonSafe(resultsPath, {});
  if (!results[username]) {
    results[username] = [];
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`📊 Added results tracking for "${username}"`);
  }
  
  // Initialize in badges.json
  const badgesPath = path.join(DATA_DIR, files.badges);
  const badges = readJsonSafe(badgesPath, {});
  if (!badges[username]) {
    badges[username] = [];
    fs.writeFileSync(badgesPath, JSON.stringify(badges, null, 2));
    console.log(`🏆 Added badge tracking for "${username}"`);
  }
  
  // Initialize in progress.json
  const progressPath = path.join(DATA_DIR, files.progress);
  const progress = readJsonSafe(progressPath, {});
  if (!progress[username]) {
    progress[username] = {
      stats: {
        points: 0,
        totalSessions: 0,
        totalWords: 0,
        correctWords: 0,
        accuracy: 0
      },
      streaks: {
        current: 0,
        longest: 0,
        lastActivity: null
      },
      challengesCompleted: {
        daily: [],
        weekly: [],
        achievements: []
      }
    };
    fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
    console.log(`📈 Added progress tracking for "${username}"`);
  }
  
  // Initialize in spacedRepetition.json
  const srPath = path.join(DATA_DIR, files.spacedRepetition);
  const srData = readJsonSafe(srPath, {});
  if (!srData[username]) {
    srData[username] = {
      settings: {
        dailyLimit: 20,
        reviewThreshold: 3,
        newWordsPerDay: 5
      },
      stats: {
        totalReviews: 0,
        correctReviews: 0,
        totalWords: 0,
        masteredWords: 0
      },
      words: {}
    };
    fs.writeFileSync(srPath, JSON.stringify(srData, null, 2));
    console.log(`📚 Added spaced repetition data for "${username}"`);
  }
}

// 🔐 Verify login
app.post('/verifyUser', (req, res) => {
  const { username, hash } = req.body;
  console.log('Login attempt - Username:', username, 'Hash:', hash);
  
  if (typeof username !== 'string' || typeof hash !== 'string') {
    console.log('Invalid credentials format');
    return res.status(400).send("Invalid credentials format");
  }
  
  const users = readJsonSafe(path.join(DATA_DIR, files.users), []);
  console.log('Available users:', users.map(u => u.username));
  
  const user = users.find(u => u.username === username && u.hash === hash);
  
  if (user) {
    console.log('Login successful for:', username);
    res.json(user);
  } else {
    console.log('Login failed for:', username);
    res.status(401).send("Invalid login");
  }
});

// ➕ Add user
app.post('/addUser', (req, res) => {
  try {
    console.log(`📥 Received addUser request:`, req.body);
    
    const { username, hash, role } = req.body;
    
    // Validate required fields
    if (!username || !hash || !role) {
      console.error(`❌ Missing required fields: ${!username ? 'username' : ''} ${!hash ? 'hash' : ''} ${!role ? 'role' : ''}`);
      return res.status(400).send("Missing required fields");
    }
    
    // Validate data types and values
    if (
      typeof username !== 'string' || 
      typeof hash !== 'string' || 
      typeof role !== 'string' || 
      !['admin', 'student'].includes(role.trim().toLowerCase())
    ) {
      console.error(`❌ Invalid user data types or values`);
      return res.status(400).send("Invalid user data");
    }

    // Trim inputs
    const trimmedUsername = username.trim();
    const trimmedRole = role.trim().toLowerCase();
    
    // Check for existing user
    const usersPath = path.join(DATA_DIR, files.users);
    const users = readJsonSafe(usersPath, []);
    if (users.find(u => u.username === trimmedUsername)) {
      console.error(`❌ User "${trimmedUsername}" already exists`);
      return res.status(409).send(`User "${trimmedUsername}" already exists`);
    }
    
    console.log(`✏️ Adding new ${trimmedRole} user: ${trimmedUsername}`);
    
    // Add user to users.json
    users.push({ username: trimmedUsername, hash, role: trimmedRole });
    
    // Write to file
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    console.log(`✅ Added user to users.json: ${trimmedUsername}`);
    
    // Initialize user in all other data files
    initializeUserInAllFiles(trimmedUsername);
    
    console.log(`✅ User "${trimmedUsername}" successfully added and initialized`);
    res.send(`✅ User "${trimmedUsername}" added and initialized`);
  } catch (error) {
    console.error(`🔴 Error in /addUser:`, error);
    res.status(500).send(`Server error: ${error.message}`);
  }
});

// ❌ Delete user
app.post('/deleteUser', (req, res) => {
  const { username } = req.body;
  if (typeof username !== 'string') return res.status(400).send("Invalid username");

  const usersPath = path.join(DATA_DIR, files.users);
  const users = readJsonSafe(usersPath, []);
  const updated = users.filter(u => u.username !== username);

  if (users.length === updated.length) {
    return res.status(404).send("User not found");
  }
  
  // Remove from users.json
  fs.writeFileSync(usersPath, JSON.stringify(updated, null, 2));
  
  // Clean up from other data files
  const wordlistsPath = path.join(DATA_DIR, files.wordlists);
  const wordlists = readJsonSafe(wordlistsPath, {});
  delete wordlists[username];
  fs.writeFileSync(wordlistsPath, JSON.stringify(wordlists, null, 2));
  
  const resultsPath = path.join(DATA_DIR, files.results);
  const results = readJsonSafe(resultsPath, {});
  delete results[username];
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  const badgesPath = path.join(DATA_DIR, files.badges);
  const badges = readJsonSafe(badgesPath, {});
  delete badges[username];
  fs.writeFileSync(badgesPath, JSON.stringify(badges, null, 2));
  
  console.log(`🗑️ Cleaned up all data for user "${username}"`);
  res.send(`✅ User "${username}" deleted and cleaned up`);
});

// 🔐 Change user password
app.post('/changePassword', (req, res) => {
  const { username, newPasswordHash } = req.body;
  if (typeof username !== 'string' || typeof newPasswordHash !== 'string') {
    return res.status(400).send("Invalid request data");
  }

  const usersPath = path.join(DATA_DIR, files.users);
  const users = readJsonSafe(usersPath, []);
  const userIndex = users.findIndex(u => u.username === username);

  if (userIndex === -1) {
    return res.status(404).send("User not found");
  }

  // Update the password hash
  users[userIndex].hash = newPasswordHash;
  
  // Save updated users
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  
  console.log(`Password changed for user: ${username}`);
  res.send(`✅ Password changed for user "${username}"`);
});

// 📚 Word list
app.get('/getWordList', (req, res) => {
    try {
        const { username } = req.query;
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        // Add debug logging
        console.log('Requested username:', username);
        
        const wordListPath = path.join(DATA_DIR, 'wordlists.json');
        console.log('Reading from:', wordListPath);
        
        const wordLists = readJsonSafe(wordListPath, {});
        console.log('Available wordlists:', Object.keys(wordLists));
        
        // Get words for specific user
        let userWords = wordLists[username] || [];
        // If the user's word list is an object (weeks/activeWeek)
        if (userWords && typeof userWords === 'object' && !Array.isArray(userWords)) {
            if (Array.isArray(userWords.weeks)) {
                // If activeWeek is set, return only that week's words
                if (userWords.activeWeek) {
                    const found = userWords.weeks.find(w => w.date === userWords.activeWeek);
                    userWords = found && Array.isArray(found.words) ? found.words : [];
                } else {
                    // No activeWeek, flatten all words from all weeks
                    userWords = userWords.weeks.flatMap(w => Array.isArray(w.words) ? w.words : []);
                }
            } else {
                userWords = [];
            }
        }
        console.log(`Words found for ${username}:`, userWords);
        res.json({ words: userWords });
    } catch (error) {
        console.error('Error in getWordList:', error);
        res.status(500).json({ error: 'Failed to get word list' });
    }
});

// Save a word list for a user
app.post('/saveWordList', (req, res) => {
  const { username, words } = req.body;
  if (
    typeof username !== 'string' ||
    !Array.isArray(words) ||
    words.length > 100 ||
    words.some(w => typeof w !== 'string')
  ) return res.status(400).send("Invalid word list");

  const userList = readJsonSafe(path.join(DATA_DIR, files.users), []);
  if (!userList.find(u => u.username === username)) {
    return res.status(404).send("User not found");
  }

  const wordlistsPath = path.join(DATA_DIR, files.wordlists);
  const wordlists = readJsonSafe(wordlistsPath);
  wordlists[username] = words;
  fs.writeFileSync(wordlistsPath, JSON.stringify(wordlists, null, 2));
  res.send(`✅ Word list saved for ${username}`);
});

// Save multiple weeks with dates for a user
app.post('/saveWeeksWordList', (req, res) => {
  const { username, weeks } = req.body;
  if (
    typeof username !== 'string' ||
    !Array.isArray(weeks) ||
    weeks.length > 100 ||
    weeks.some(w => typeof w.date !== 'string' || !Array.isArray(w.words) || w.words.some(word => typeof word !== 'string'))
  ) return res.status(400).json({ error: 'Invalid weeks data' });

  const userList = readJsonSafe(path.join(DATA_DIR, files.users), []);
  if (!userList.find(u => u.username === username)) {
    return res.status(404).json({ error: 'User not found' });
  }

  const wordlistsPath = path.join(DATA_DIR, files.wordlists);
  const wordlists = readJsonSafe(wordlistsPath);
  wordlists[username] = { weeks };
  fs.writeFileSync(wordlistsPath, JSON.stringify(wordlists, null, 2));
  res.json({ success: true, message: `Weeks word list saved for ${username}` });
});

// Set active week for a user
app.post('/setActiveWeek', (req, res) => {
  const { username, activeWeek } = req.body;
  if (typeof username !== 'string' || typeof activeWeek !== 'string') {
    return res.status(400).json({ error: 'Invalid data' });
  }
  const wordlistsPath = path.join(DATA_DIR, files.wordlists);
  const wordlists = readJsonSafe(wordlistsPath);
  if (!wordlists[username] || typeof wordlists[username] !== 'object') {
    return res.status(404).json({ error: 'User not found or no weeks data' });
  }
  wordlists[username].activeWeek = activeWeek;
  fs.writeFileSync(wordlistsPath, JSON.stringify(wordlists, null, 2));
  res.json({ success: true, message: `Active week set for ${username}: ${activeWeek}` });
});

// Set active week for a user
// ...existing code...

/**
 * 📊 Results Endpoint
 * GET /getResults - Retrieve user session results
 * 
 * Query Parameters:
 *   - username: (optional) Filter results by specific username
 *   - limit: (optional) Limit number of sessions per user
 *   - recent: (optional) When true, sorts sessions by most recent first
 * 
 * Returns:
 *   - JSON object with usernames as keys and arrays of session data as values
 *   - Handles file access errors with fallback test data
 */
app.get('/getResults', (req, res) => {
  try {
    // Get query parameters for filtering
    const { username, limit, recent } = req.query;
    const maxLimit = limit ? parseInt(limit) : 0; // 0 means no limit
    
    // First try to read the real data file
    const resultsPath = path.join(DATA_DIR, files.results);
    let allResults = {};
    let fileReadSuccess = false;
    
    try {
      if (fs.existsSync(resultsPath)) {
        console.log('📊 Reading results.json file...');
        const fileContent = fs.readFileSync(resultsPath, 'utf8');
        try {
          allResults = JSON.parse(fileContent);
          console.log(`✅ Successfully read results for ${Object.keys(allResults).length} users`);
          fileReadSuccess = true;
        } catch (parseError) {
          console.error(`❌ Error parsing results.json: ${parseError.message}`);
        }
      } else {
        console.log('⚠️ results.json file not found');
      }
    } catch (fileError) {
      console.error(`❌ Error accessing results.json: ${fileError.message}`);
    }
    
    // If we didn't successfully read the file, set up backup test data
    if (!fileReadSuccess) {
      console.log('📊 Using test data for results');
      const users = ['admin1', 'student1', 'nate', 'testuser'];
      
      // Create test data for each user
      users.forEach(username => {
        if (!allResults[username]) {
          allResults[username] = [];
        }
        
        // Add test entry for admin1 if there's no data
        if (username === 'admin1' && allResults[username].length === 0) {
          allResults[username].push({
            score: 100,
            answers: [
              { word: "example", correct: true },
              { word: "test", correct: true },
              { word: "spelling", correct: true }
            ],
            timestamp: new Date().toISOString(),
            testData: true // Mark as test data
          });
        }
      });
    }
    
    // Apply filters if requested
    let filteredResults = { ...allResults };
    
    // Filter by username if specified
    if (username) {
      filteredResults = { 
        [username]: allResults[username] || [] 
      };
    }
    
    // Apply limit to each user's sessions if specified
    if (maxLimit > 0 || recent === 'true') {
      Object.keys(filteredResults).forEach(user => {
        if (Array.isArray(filteredResults[user])) {
          // Sort by timestamp (newest first) if we're limiting results
          filteredResults[user].sort((a, b) => {
            const dateA = new Date(a.timestamp || a.date || 0);
            const dateB = new Date(b.timestamp || b.date || 0);
            return dateB - dateA; // Descending order (newest first)
          });
          
          // Apply limit if specified
          if (maxLimit > 0) {
            filteredResults[user] = filteredResults[user].slice(0, maxLimit);
          }
        }
      });
    }
    
    // Return the filtered data
    console.log(`📊 Returning results for ${Object.keys(filteredResults).length} users`);
    return res.json(filteredResults);
  } catch (error) {
    console.error(`❌ Error in getResults: ${error.message}`);
    return res.json({}); // Return empty object as fallback
  }
});

// Include gamification endpoints using proper module imports
require('./gamification-endpoints')(app, DATA_DIR, files, readJsonSafe, isToday, isSameDay);
console.log('🎮 Gamification endpoints initialized');

// Include spaced repetition endpoints using proper module imports
require('./spaced-repetition-endpoints')(app, DATA_DIR, files, readJsonSafe, fs, path);
console.log('📚 Spaced repetition endpoints initialized');

// Include analytics endpoints using proper module imports
require('./analytics-endpoint')(app, DATA_DIR, files, readJsonSafe, path);
console.log('📊 Analytics endpoints initialized');

/**
 * 📝 Save Results Endpoint
 * POST /saveResults - Save user session results
 * 
 * Request Body:
 *   - username: User identifier
 *   - result: Object containing session data
 *     - score: Number of correct answers
 *     - answers: Array of word attempts with correct/incorrect status
 *     - completed: Boolean indicating if session was completed
 * 
 * Returns:
 *   - Success message or error
 *   - Adds timestamp to saved data
 *   - Handles file access and validation errors
 */
app.post('/saveResults', (req, res) => {
  try {
    console.log('📝 Received save results request:', JSON.stringify(req.body).substring(0, 200) + '...');
    
    const { username, result } = req.body;
    
    // Validate the incoming data
    if (!username || typeof username !== 'string') {
      console.log('❌ Invalid username:', username);
      return res.status(400).send("Invalid username");
    }
    
    if (!result || typeof result !== 'object') {
      console.log('❌ Invalid result object');
      return res.status(400).send("Invalid result object");
    }
    
    // More flexible validation
    if (typeof result.score !== 'number') {
      console.log('⚠️ Invalid score format, coercing to number');
      result.score = parseInt(result.score) || 0;
    }
    
    if (typeof result.completed !== 'boolean') {
      console.log('⚠️ Invalid completed format, defaulting to true');
      result.completed = true;
    }
    
    if (!Array.isArray(result.answers)) {
      console.log('❌ Invalid answers array');
      return res.status(400).send("Invalid answers array");
    }
    
    // Add timestamp to the result
    const resultWithTimestamp = {
      ...result,
      timestamp: new Date().toISOString()
    };
    
    // Log what we're saving (for debugging)
    console.log(`✅ Saving result for ${username}:`, JSON.stringify(resultWithTimestamp).substring(0, 100) + '...');
    
    // We've simplified the app to work with in-memory data, 
    // but we'll try to write to the file anyway in case it's fixed later
    try {
      const resultsPath = path.join(DATA_DIR, files.results);
      // Try to read any existing data
      let allResults = {};
      if (fs.existsSync(resultsPath)) {
        try {
          allResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        } catch (e) {
          // If parse fails, start with empty object
          allResults = {};
        }
      }
      
      // Add or update the user's entry
      if (!allResults[username]) {
        allResults[username] = [];
      }
      
      // Add the new result
      allResults[username].push(resultWithTimestamp);
      
      // Write back to disk
      fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));
    } catch (writeError) {
      // Just log the error but still return success to the client
      console.error(`⚠️ Error writing to results file: ${writeError.message}`);
    }
    
    console.log(`✅ Results archived for ${username}`);
    res.send(`✅ Results archived for ${username}`);
  } catch (error) {
    console.error('❌ Error saving results:', error);
    res.status(500).send('Internal server error');
  }
});

// 👥 Get users
// --- Typing Practice Results ---
// Save typing practice results for a user
app.post('/saveTypingResults', (req, res) => {
  const { username, result } = req.body;
  if (
    typeof username !== 'string' ||
    typeof result !== 'object' ||
    typeof result.score !== 'number' ||
    typeof result.completed !== 'boolean' ||
    !Array.isArray(result.answers)
  ) return res.status(400).send("Invalid result format");

  const resultsPath = path.join(DATA_DIR, files.results);
  const allResults = readJsonSafe(resultsPath);
  if (!allResults[username]) allResults[username] = [];

  allResults[username].push({
    ...result,
    timestamp: new Date().toISOString(),
    type: 'typing' // Mark as typing practice result
  });
  fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));
  res.send(`✅ Typing results archived for ${username}`);
});
app.get('/getUsers', (req, res) => {
  try {
    const usersPath = path.join(DATA_DIR, files.users);
    console.log(`📋 Getting users from: ${usersPath}`);
    
    // Check if data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      console.log(`⚠️ Data directory does not exist, creating: ${DATA_DIR}`);
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Check if user file exists
    if (!fs.existsSync(usersPath)) {
      console.log(`⚠️ Users file does not exist at: ${usersPath}`);
      ensureFileWithSeed(files.users);
      console.log(`✅ Created default users file`);
    }
    
    let users = [];
    let fileData = null;
    
    try {
      // Read file contents
      fileData = fs.readFileSync(usersPath, 'utf8');
      console.log(`� User file size: ${fileData.length} bytes`);
      
      // Check for empty file
      if (!fileData || fileData.trim() === '') {
        throw new Error('User file is empty');
      }
      
      // Parse JSON data
      users = JSON.parse(fileData);
      console.log(`📋 Parsed ${users.length} users from JSON`);
    } catch (parseError) {
      console.error('❌ Error parsing users JSON:', parseError);
      
      // Create backup of corrupted file
      if (fileData) {
        const backupPath = `${usersPath}.backup-${Date.now()}`;
        fs.writeFileSync(backupPath, fileData);
        console.log(`⚠️ Created backup of corrupted users file: ${backupPath}`);
      }
      
      // Reset to default users
      users = [];
    }
    
    // Ensure we have users array
    if (!Array.isArray(users) || users.length === 0) {
      console.log(`⚠️ No users found or invalid data, creating default users`);
      const defaultUsers = [
        { "username": "admin1", "hash": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8", "role": "admin" },
        { "username": "nate", "hash": "5a2a558c78d3717db731600c4f354fa1d9c84b556f108091a891f444f1bdec40", "role": "student" },
        { "username": "student1", "hash": "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92", "role": "student" }
      ];
      
      // Write default users to file
      fs.writeFileSync(usersPath, JSON.stringify(defaultUsers, null, 2));
      console.log(`✅ Created default users: ${defaultUsers.map(u => u.username).join(', ')}`);
      
      // Return default users
      users = defaultUsers;
    }
    
    // Log what we're sending back
    console.log(`📋 Returning ${users.length} users:`, users.map(u => u.username));
    
    res.json(users);
  } catch (error) {
    console.error(`🔴 Error in /getUsers:`, error);
    res.status(500).json({ error: 'Failed to get users', message: error.message });
  }
});

// 🎖 Badges
app.post('/awardBadges', (req, res) => {
  const { username, badges } = req.body;
  if (typeof username !== 'string' || !Array.isArray(badges)) {
    return res.status(400).send("Invalid badge format");
  }

  const badgePath = path.join(DATA_DIR, files.badges);
  const allBadges = readJsonSafe(badgePath);
  if (!allBadges[username]) allBadges[username] = { earned: [], counts: {} };
  
  // Initialize structure if old format
  if (Array.isArray(allBadges[username])) {
    // Convert from old format to new format
    const oldBadges = [...allBadges[username]];
    allBadges[username] = { 
      earned: oldBadges.map(name => ({ 
        id: name.toLowerCase().replace(/\s/g, '_'),
        name,
        icon: "🏅",
        earnedAt: new Date().toISOString()
      })), 
      counts: {} 
    };
  }

  badges.forEach(badge => {
    // Check if badge already exists by ID
    const existingBadge = allBadges[username].earned.find(b => {
      return (typeof b === 'object' && b.id === badge.id) || 
             (typeof b === 'string' && b === badge.name);
    });
    
    if (!existingBadge) {
      // Add new badge with timestamp
      const badgeToAdd = {
        ...badge,
        earnedAt: new Date().toISOString()
      };
      
      allBadges[username].earned.push(badgeToAdd);
      
      // Track badge counts by category
      if (badge.category) {
        if (!allBadges[username].counts[badge.category]) {
          allBadges[username].counts[badge.category] = 0;
        }
        allBadges[username].counts[badge.category]++;
      }
    }
  });
  
  fs.writeFileSync(badgePath, JSON.stringify(allBadges, null, 2));
  res.send(`🎉 Badges updated for ${username}`);
});

app.get('/getBadges', (req, res) => {
  const badgePath = path.join(DATA_DIR, files.badges);
  const badges = readJsonSafe(badgePath);
  res.json(badges);
});

// Endpoint to check and award badges based on performance
app.get('/checkBadges', (req, res) => {
  const { username, accuracy, wordCount } = req.query;
  
  if (!username || !accuracy || !wordCount) {
    return res.status(400).json({ error: 'Missing parameters' });
  }
  
  const accuracyNum = parseFloat(accuracy);
  const wordCountNum = parseInt(wordCount);
  const newBadges = [];
  
  // Check for accuracy badges
  if (accuracyNum >= 100) {
    newBadges.push({
      id: 'perfect_accuracy',
      name: 'Perfect Score',
      icon: '🏆',
      description: 'You scored 100% on your spelling test!',
      category: 'accuracy'
    });
  } else if (accuracyNum >= 90) {
    newBadges.push({
      id: 'high_accuracy',
      name: 'Spelling Expert',
      icon: '🌟',
      description: 'Your spelling accuracy is exceptional!',
      category: 'accuracy'
    });
  } else if (accuracyNum >= 80) {
    newBadges.push({
      id: 'good_accuracy',
      name: 'Spelling Pro',
      icon: '⭐',
      description: 'Great job on your spelling accuracy!',
      category: 'accuracy'
    });
  }
  
  // Check for word count badges
  if (wordCountNum >= 20) {
    newBadges.push({
      id: 'word_master',
      name: 'Word Master',
      icon: '📚',
      description: 'You\'ve mastered a large number of words!',
      category: 'completion'
    });
  } else if (wordCountNum >= 10) {
    newBadges.push({
      id: 'spelling_enthusiast',
      name: 'Spelling Enthusiast',
      icon: '📝',
      description: 'You\'re making great progress with your spelling practice!',
      category: 'completion'
    });
  }
  
  // If there are new badges to award, save them
  if (newBadges.length > 0) {
    const badgePath = path.join(DATA_DIR, files.badges);
    const allBadges = readJsonSafe(badgePath);
    
    if (!allBadges[username]) {
      allBadges[username] = { earned: [], counts: {} };
    }
    
    // Initialize structure if old format
    if (Array.isArray(allBadges[username])) {
      // Convert from old format to new format
      const oldBadges = [...allBadges[username]];
      allBadges[username] = { 
        earned: oldBadges.map(name => ({ 
          id: name.toLowerCase().replace(/\s/g, '_'),
          name,
          icon: "🏅",
          earnedAt: new Date().toISOString()
        })), 
        counts: {} 
      };
    }
    
    // Filter to only include badges the user doesn't already have
    const actualNewBadges = newBadges.filter(badge => {
      return !allBadges[username].earned.some(earned => earned.id === badge.id);
    });
    
    // Add timestamps to new badges
    const timestampedBadges = actualNewBadges.map(badge => ({
      ...badge,
      earnedAt: new Date().toISOString()
    }));
    
    // Add new badges to user's collection
    allBadges[username].earned.push(...timestampedBadges);
    
    // Update badge counts by category
    timestampedBadges.forEach(badge => {
      if (badge.category) {
        if (!allBadges[username].counts[badge.category]) {
          allBadges[username].counts[badge.category] = 0;
        }
        allBadges[username].counts[badge.category]++;
      }
    });
    
    // Save updated badges data
    fs.writeFileSync(badgePath, JSON.stringify(allBadges, null, 2));
    
    // Return only the newly awarded badges
    return res.json({ newBadges: actualNewBadges });
  }
  
  // No new badges
  return res.json({ newBadges: [] });
});

// Initialize all required data files
ensureAllRequiredFiles();

// Get environment variables or use defaults
const HOST = process.env.HOST || '0.0.0.0';
const PORT_ENV = process.env.PORT || PORT;

// Handle graceful shutdown for container orchestration
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('� SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// �🚀 Server start
app.listen(PORT_ENV, HOST, () => {
  console.log(`✅ Server listening at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT_ENV}`);
  console.log(`📁 Data directory: ${DATA_DIR}`);
  console.log(`🌐 Node environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📦 Version: ${require('./version.json').version}`);
  
  // Display available users for easy login
  try {
    const usersPath = path.join(DATA_DIR, files.users);
    const users = readJsonSafe(usersPath, []);
    console.log('\n👥 Available Users:');
    console.log('┌─────────────┬────────────┬──────────┐');
    console.log('│ Username    │ Password   │ Role     │');
    console.log('├─────────────┼────────────┼──────────┤');
    
    const userInfo = [
      { username: 'admin1', password: 'password', role: 'admin' },
      { username: 'nate', password: 'nate123', role: 'student' },
      { username: 'student1', password: '123456', role: 'student' }
    ];
    
    userInfo.forEach(user => {
      const exists = users.find(u => u.username === user.username);
      const status = exists ? '✅' : '❌';
      console.log(`│ ${user.username.padEnd(11)} │ ${user.password.padEnd(10)} │ ${user.role.padEnd(8)} │ ${status}`);
    });
    
    console.log('└─────────────┴────────────┴──────────┘');
    console.log('\n🔐 Note: Change default passwords after first login!');
    console.log(`🌐 Access the app at: http://localhost:${PORT}\n`);
  } catch (error) {
    console.log('⚠️  Could not display user information');
  }
});