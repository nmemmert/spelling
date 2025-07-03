const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// 📁 Static assets
app.use(express.static('public'));
app.use(express.json());

// 🗂 Ensure data directory and files exist
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const files = {
  users: 'users.json',
  wordlists: 'wordlists.json',
  results: 'results.json',
  badges: 'badges.json'
};

for (const file of Object.values(files)) {
  const target = path.join(DATA_DIR, file);
  if (!fs.existsSync(target)) {
    const defaultData = file === 'users.json' ? '[]' : '{}';
    fs.writeFileSync(target, defaultData);
    console.log(`📄 Initialized ${file}`);
  }
}

// 🛡 Safe JSON reader
function readJsonSafe(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

// 🔐 Verify user credentials
app.post('/verifyUser', (req, res) => {
  const { username, hash } = req.body;
  if (typeof username !== 'string' || typeof hash !== 'string') {
    return res.status(400).send("Invalid credentials format");
  }

  const users = readJsonSafe(path.join(DATA_DIR, files.users), []);
  const user = users.find(u => u.username === username && u.hash === hash);

  if (user) {
    res.json(user);
  } else {
    res.status(401).send("Invalid login");
  }
});

// ➕ Add new user
app.post('/addUser', (req, res) => {
  const { username, hash, role } = req.body;

  if (
    typeof username !== 'string' || 
    typeof hash !== 'string' || 
    typeof role !== 'string' || 
    !['admin', 'student'].includes(role.trim().toLowerCase())
  ) {
    return res.status(400).send("Invalid user data");
  }

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

// 📚 Get word list
app.get('/getWordList', (req, res) => {
  const username = req.query.user;
  if (!username || typeof username !== 'string') {
    return res.status(400).send("Username required");
  }

  const wordlists = readJsonSafe(path.join(DATA_DIR, files.wordlists));
  res.json(wordlists[username] || []);
});

// 💾 Save word list
app.post('/saveWordList', (req, res) => {
  const { username, words } = req.body;

  if (
    typeof username !== 'string' || 
    !Array.isArray(words) || 
    words.length > 100 || 
    words.some(w => typeof w !== 'string')
  ) {
    return res.status(400).send("Invalid word list");
  }

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

// 📊 Get results
app.get('/getResults', (req, res) => {
  const results = readJsonSafe(path.join(DATA_DIR, files.results));
  res.json(results);
});

// 🚀 Launch server
app.listen(PORT, () => {
  console.log(`✅ Server listening at http://localhost:${PORT}`);
});
app.post('/saveResults', (req, res) => {
  const { username, result } = req.body;

  if (
    typeof username !== 'string' ||
    typeof result !== 'object' ||
    typeof result.score !== 'number' ||
    typeof result.completed !== 'boolean' ||
    !Array.isArray(result.answers)
  ) {
    return res.status(400).send("Invalid result format");
  }

  const resultsPath = path.join(DATA_DIR, files.results);
  const allResults = readJsonSafe(resultsPath);

  allResults[username] = result;

  fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));
  res.send(`✅ Results saved for ${username}`);
});
app.get('/getUsers', (req, res) => {
  const users = readJsonSafe(path.join(DATA_DIR, files.users), []);
  res.json(users);
});


const badgePath = path.join(DATA_DIR, files.badges);
app.post('/awardBadges', (req, res) => {
  const { username, badges } = req.body;
  if (
    typeof username !== 'string' ||
    !Array.isArray(badges)
  ) return res.status(400).send("Invalid badge format");

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