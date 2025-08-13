const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve raw wordlists.json for admin UI (must come after app is defined)
app.get('/getWordlistsRaw', (req, res) => {
  const wordlists = readJsonSafe(path.join(DATA_DIR, files.wordlists), {});
  res.json(wordlists);
});

// 📁 Static assets
app.use(express.static('public'));
app.use(express.json());

// 🗂 Directories
const DATA_DIR = path.join(__dirname, 'data');
const SEED_DIR = path.join(__dirname, 'seed');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// 🗃 File mapping
const files = {
  users: 'users.json',
  wordlists: 'wordlists.json',
  results: 'results.json',
  badges: 'badges.json'
};

// 🌱 Initialize data from seeds if missing/empty
function ensureFileWithSeed(name, fallback = '{}') {
  const targetPath = path.join(DATA_DIR, name);
  const seedPath = path.join(SEED_DIR, name);

  if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, 'utf-8').trim() === '') {
    if (fs.existsSync(seedPath)) {
      fs.copyFileSync(seedPath, targetPath);
      console.log(`🌱 Seeded ${name} from seed/${name}`);
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
  const { username, hash, role } = req.body;
  if (
    typeof username !== 'string' || 
    typeof hash !== 'string' || 
    typeof role !== 'string' || 
    !['admin', 'student'].includes(role.trim().toLowerCase())
  ) return res.status(400).send("Invalid user data");

  const users = readJsonSafe(path.join(DATA_DIR, files.users), []);
  if (users.find(u => u.username === username)) {
    return res.status(409).send("User already exists");
  }
  
  // Add user to users.json
  users.push({ username: username.trim(), hash, role: role.trim() });
  fs.writeFileSync(path.join(DATA_DIR, files.users), JSON.stringify(users, null, 2));
  
  // Initialize user in all other data files
  initializeUserInAllFiles(username.trim());
  
  res.send(`✅ User "${username}" added and initialized`);
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
  ) return res.status(400).send('Invalid weeks data');

  const userList = readJsonSafe(path.join(DATA_DIR, files.users), []);
  if (!userList.find(u => u.username === username)) {
    return res.status(404).send('User not found');
  }

  const wordlistsPath = path.join(DATA_DIR, files.wordlists);
  const wordlists = readJsonSafe(wordlistsPath);
  wordlists[username] = { weeks };
  fs.writeFileSync(wordlistsPath, JSON.stringify(wordlists, null, 2));
  res.send(`✅ Weeks word list saved for ${username}`);
});

// Set active week for a user
app.post('/setActiveWeek', (req, res) => {
  const { username, activeWeek } = req.body;
  if (typeof username !== 'string' || typeof activeWeek !== 'string') {
    return res.status(400).send('Invalid data');
  }
  const wordlistsPath = path.join(DATA_DIR, files.wordlists);
  const wordlists = readJsonSafe(wordlistsPath);
  if (!wordlists[username] || typeof wordlists[username] !== 'object') {
    return res.status(404).send('User not found or no weeks data');
  }
  wordlists[username].activeWeek = activeWeek;
  fs.writeFileSync(wordlistsPath, JSON.stringify(wordlists, null, 2));
  res.send(`✅ Active week set for ${username}: ${activeWeek}`);
});

// Set active week for a user
// ...existing code...

// 📊 Results
app.get('/getResults', (req, res) => {
  const results = readJsonSafe(path.join(DATA_DIR, files.results));
  res.json(results);
});

// 📈 Enhanced Analytics API endpoint
app.get('/getAnalytics', (req, res) => {
  try {
    const results = readJsonSafe(path.join(DATA_DIR, files.results), {});
    
    // Prepare analytics data structure
    const analytics = {
      summary: {
        totalSessions: 0,
        totalWords: 0,
        correctWords: 0,
        overallAccuracy: 0,
        averageScore: 0,
        mostMissedWords: [],
        activityByDate: {}
      },
      userStats: {},
      wordStats: {}
    };
    
    // Process all results data
    Object.keys(results).forEach(username => {
      // Skip if user has no results
      if (!Array.isArray(results[username]) || results[username].length === 0) return;
      
      // Initialize user stats if not already present
      if (!analytics.userStats[username]) {
        analytics.userStats[username] = {
          totalSessions: 0,
          totalWords: 0,
          correctWords: 0,
          accuracy: 0,
          averageScore: 0,
          trend: [], // For progress over time
          recentResults: [],
          problemWords: []
        };
      }
      
      // Process each session for this user
      results[username].forEach(session => {
        // Skip invalid sessions
        if (!session || !session.answers || !Array.isArray(session.answers)) return;
        
        // Update summary counts
        analytics.summary.totalSessions++;
        analytics.userStats[username].totalSessions++;
        
        // Process session date for activity tracking
        const sessionDate = new Date(session.timestamp || Date.now()).toISOString().split('T')[0];
        analytics.summary.activityByDate[sessionDate] = (analytics.summary.activityByDate[sessionDate] || 0) + 1;
        
        // Collect score for trending data
        if (typeof session.score === 'number' && session.answers.length > 0) {
          const accuracy = session.score / session.answers.length;
          analytics.userStats[username].trend.push({
            date: sessionDate,
            accuracy: accuracy * 100,
            score: session.score,
            total: session.answers.length
          });
        }
        
        // Keep only most recent 10 sessions for the trend data
        if (analytics.userStats[username].trend.length > 10) {
          analytics.userStats[username].trend = analytics.userStats[username].trend.slice(-10);
        }
        
        // Get the 5 most recent results for display
        if (analytics.userStats[username].recentResults.length < 5) {
          analytics.userStats[username].recentResults.push({
            date: new Date(session.timestamp || Date.now()).toLocaleString(),
            score: session.score,
            total: session.answers.length,
            completed: session.completed
          });
        }
        
        // Process individual words in the session
        session.answers.forEach(answer => {
          // Skip invalid answers
          if (!answer || typeof answer.word !== 'string') return;
          
          // Update word stats
          const word = answer.word.toLowerCase();
          
          if (!analytics.wordStats[word]) {
            analytics.wordStats[word] = {
              attempts: 0,
              correct: 0,
              incorrect: 0,
              accuracy: 0
            };
          }
          
          analytics.wordStats[word].attempts++;
          analytics.summary.totalWords++;
          analytics.userStats[username].totalWords++;
          
          if (answer.correct) {
            analytics.wordStats[word].correct++;
            analytics.summary.correctWords++;
            analytics.userStats[username].correctWords++;
          } else {
            analytics.wordStats[word].incorrect++;
            
            // Track problem words for this user
            const problemWordIndex = analytics.userStats[username].problemWords.findIndex(pw => pw.word === word);
            
            if (problemWordIndex >= 0) {
              analytics.userStats[username].problemWords[problemWordIndex].count++;
            } else {
              analytics.userStats[username].problemWords.push({
                word,
                count: 1
              });
            }
          }
          
          // Calculate accuracy for this word
          analytics.wordStats[word].accuracy = 
            analytics.wordStats[word].correct / analytics.wordStats[word].attempts * 100;
        });
        
        // Calculate user accuracy and average score
        analytics.userStats[username].accuracy = 
          analytics.userStats[username].correctWords / analytics.userStats[username].totalWords * 100 || 0;
        analytics.userStats[username].averageScore = 
          analytics.userStats[username].correctWords / analytics.userStats[username].totalSessions || 0;
      });
      
      // Sort problem words by count (descending)
      analytics.userStats[username].problemWords.sort((a, b) => b.count - a.count);
      
      // Keep only top 5 problem words
      analytics.userStats[username].problemWords = analytics.userStats[username].problemWords.slice(0, 5);
    });
    
    // Calculate overall metrics
    analytics.summary.overallAccuracy = 
      analytics.summary.correctWords / analytics.summary.totalWords * 100 || 0;
    analytics.summary.averageScore = 
      analytics.summary.correctWords / analytics.summary.totalSessions || 0;
    
    // Find most missed words (top 5)
    const missedWords = Object.keys(analytics.wordStats)
      .map(word => ({
        word,
        missCount: analytics.wordStats[word].incorrect
      }))
      .filter(item => item.missCount > 0)
      .sort((a, b) => b.missCount - a.missCount)
      .slice(0, 5);
    
    analytics.summary.mostMissedWords = missedWords;
    
    res.json(analytics);
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).send('Error generating analytics data');
  }
});

app.post('/saveResults', (req, res) => {
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
    timestamp: new Date().toISOString()
  });
  fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));
  res.send(`✅ Results archived for ${username}`);
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
  const users = readJsonSafe(path.join(DATA_DIR, files.users), []);
  res.json(users);
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

// 🚀 Server start
app.listen(PORT, () => {
  console.log(`✅ Server listening at http://localhost:${PORT}`);
  
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