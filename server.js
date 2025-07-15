const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

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
      fs.writeFileSync(targetPath, fallback);
      console.log(`📄 Initialized ${name} with default`);
    }
  }
}

for (const [key, file] of Object.entries(files)) {
  const defaultData = file === 'users.json' ? '[]' : '{}';
  ensureFileWithSeed(file, defaultData);
}

// 🔐 JSON utility
function readJsonSafe(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
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
  users.push({ username: username.trim(), hash, role: role.trim() });
  fs.writeFileSync(path.join(DATA_DIR, files.users), JSON.stringify(users, null, 2));
  res.send(`✅ User "${username}" added`);
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
  fs.writeFileSync(usersPath, JSON.stringify(updated, null, 2));
  res.send(`✅ User "${username}" deleted`);
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
        const userWords = wordLists[username] || [];
        console.log(`Words found for ${username}:`, userWords);
        
        res.json({ words: userWords });
    } catch (error) {
        console.error('Error in getWordList:', error);
        res.status(500).json({ error: 'Failed to get word list' });
    }
});

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

// 📊 Results
app.get('/getResults', (req, res) => {
  const results = readJsonSafe(path.join(DATA_DIR, files.results));
  res.json(results);
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
  if (!allBadges[username]) allBadges[username] = [];

  badges.forEach(b => {
    if (!allBadges[username].includes(b)) {
      allBadges[username].push(b);
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
});