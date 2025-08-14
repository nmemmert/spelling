// This script directly fixes the user addition functionality
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Function to hash password using SHA-256
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Function to safely read JSON files
function readJsonSafe(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      if (!data || data.trim() === '') return defaultValue;
      return JSON.parse(data);
    }
    return defaultValue;
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
    return defaultValue;
  }
}

// Initialize user in all data files
function initializeUserInAllFiles(username) {
  console.log(`🔧 Initializing user "${username}" across all data files`);
  
  // Initialize in wordlists.json
  const wordlistsPath = path.join(DATA_DIR, 'wordlists.json');
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
  const resultsPath = path.join(DATA_DIR, 'results.json');
  const results = readJsonSafe(resultsPath, {});
  if (!results[username]) {
    results[username] = [];
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`📊 Added results tracking for "${username}"`);
  }
  
  // Initialize in badges.json
  const badgesPath = path.join(DATA_DIR, 'badges.json');
  const badges = readJsonSafe(badgesPath, {});
  if (!badges[username]) {
    badges[username] = [];
    fs.writeFileSync(badgesPath, JSON.stringify(badges, null, 2));
    console.log(`🏆 Added badge tracking for "${username}"`);
  }
  
  // Initialize in progress.json
  const progressPath = path.join(DATA_DIR, 'progress.json');
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
  const srPath = path.join(DATA_DIR, 'spacedRepetition.json');
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

// Add a new user
function addUser(username, password, role) {
  if (
    typeof username !== 'string' || 
    typeof password !== 'string' || 
    typeof role !== 'string' || 
    !['admin', 'student'].includes(role.trim().toLowerCase())
  ) {
    console.error("❌ Invalid user data");
    return false;
  }

  // Clean inputs
  username = username.trim();
  role = role.trim().toLowerCase();
  
  // Read users
  const users = readJsonSafe(USERS_FILE, []);
  
  // Check if user exists
  if (users.find(u => u.username === username)) {
    console.error(`❌ User "${username}" already exists`);
    return false;
  }
  
  // Hash password
  const hash = hashPassword(password);
  
  // Add user to users.json
  users.push({ username, hash, role });
  
  try {
    // Write users to file
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    console.log(`✅ User "${username}" added to users.json`);
    
    // Initialize user in all data files
    initializeUserInAllFiles(username);
    
    console.log(`✅ User "${username}" successfully added and initialized`);
    return true;
  } catch (error) {
    console.error(`❌ Error adding user: ${error.message}`);
    return false;
  }
}

// Define user to add
const NEW_USERNAME = "newstudent";
const NEW_PASSWORD = "newpassword";
const NEW_ROLE = "student";

// Add the user
const result = addUser(NEW_USERNAME, NEW_PASSWORD, NEW_ROLE);

// Show result
if (result) {
  console.log("\n✅ USER ADDED SUCCESSFULLY!");
  console.log(`Username: ${NEW_USERNAME}`);
  console.log(`Password: ${NEW_PASSWORD}`);
  console.log(`Role: ${NEW_ROLE}`);
  
  // List all users
  const users = readJsonSafe(USERS_FILE, []);
  console.log("\n👥 Current Users:");
  users.forEach(user => {
    console.log(`- ${user.username} (${user.role})`);
  });
} else {
  console.error("\n❌ FAILED TO ADD USER");
}
