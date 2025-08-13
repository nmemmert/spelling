/**
 * Generate sample leaderboard data for the Spelling Practice App
 * This script will populate leaderboards with realistic data for the analytics dashboard
 */

const fs = require('fs');
const path = require('path');

// Define paths
const DATA_DIR = path.join(__dirname, 'data');
const files = {
  users: path.join(DATA_DIR, 'users.json'),
  progress: path.join(DATA_DIR, 'progress.json'),
  leaderboards: path.join(DATA_DIR, 'leaderboards.json')
};

// Helper functions
function readJsonSafe(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
    return defaultValue;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return defaultValue;
  }
}

function writeJsonSafe(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
    return false;
  }
}

// Random helpers
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function randomFloat(min, max, decimals = 2) {
  const rand = Math.random() * (max - min) + min;
  return parseFloat(rand.toFixed(decimals));
}

// Generate additional fake users for the leaderboards
function generateFakeUsers(count) {
  const firstNames = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'William', 'Sophia', 'James', 'Isabella', 'Logan', 
    'Mia', 'Benjamin', 'Charlotte', 'Mason', 'Amelia', 'Elijah', 'Harper', 'Oliver', 'Evelyn', 'Jacob'];
  
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
  
  const users = [];
  
  for (let i = 0; i < count; i++) {
    const firstName = firstNames[randomInt(0, firstNames.length - 1)];
    const lastName = lastNames[randomInt(0, lastNames.length - 1)];
    const username = `${firstName.toLowerCase()}${lastName.substring(0, 1).toLowerCase()}${randomInt(1, 99)}`;
    
    users.push(username);
  }
  
  return users;
}

// Main function to generate leaderboard data
async function generateLeaderboardData() {
  console.log('Generating sample leaderboard data...');
  
  // Load users and progress data
  const users = readJsonSafe(files.users, []);
  const progressData = readJsonSafe(files.progress, {});
  
  if (users.length === 0) {
    console.error('No users found. Please ensure users exist before running this script.');
    return;
  }
  
  // Generate 10 additional fake users for leaderboards
  const fakeUsers = generateFakeUsers(10);
  const allUsers = [...users.map(u => u.username), ...fakeUsers];
  
  // Create leaderboard data
  const leaderboards = {
    allTime: {
      accuracy: [],
      totalWords: [],
      sessionsCompleted: [],
      streakDays: []
    },
    weekly: {
      accuracy: [],
      totalWords: [],
      sessionsCompleted: []
    },
    currentWeek: `${new Date().getFullYear()}-${Math.ceil((new Date().getDate() + new Date().getDay()) / 7)}`
  };
  
  // Generate data for each category
  
  // All-time accuracy leaderboard
  allUsers.forEach(username => {
    // For real users, use their actual progress data if available
    if (progressData[username]) {
      leaderboards.allTime.accuracy.push({
        username,
        value: progressData[username].stats.accuracy || randomFloat(70, 98, 1),
        timestamp: new Date().toISOString()
      });
    } else {
      // For fake users, generate random data
      leaderboards.allTime.accuracy.push({
        username,
        value: randomFloat(70, 98, 1),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Sort by value (descending)
  leaderboards.allTime.accuracy.sort((a, b) => b.value - a.value);
  
  // All-time totalWords leaderboard
  allUsers.forEach(username => {
    if (progressData[username]) {
      leaderboards.allTime.totalWords.push({
        username,
        value: progressData[username].stats.totalWords || randomInt(100, 1000),
        timestamp: new Date().toISOString()
      });
    } else {
      leaderboards.allTime.totalWords.push({
        username,
        value: randomInt(100, 1000),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  leaderboards.allTime.totalWords.sort((a, b) => b.value - a.value);
  
  // All-time sessionsCompleted leaderboard
  allUsers.forEach(username => {
    if (progressData[username]) {
      leaderboards.allTime.sessionsCompleted.push({
        username,
        value: progressData[username].stats.totalSessions || randomInt(5, 50),
        timestamp: new Date().toISOString()
      });
    } else {
      leaderboards.allTime.sessionsCompleted.push({
        username,
        value: randomInt(5, 50),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  leaderboards.allTime.sessionsCompleted.sort((a, b) => b.value - a.value);
  
  // All-time streakDays leaderboard
  allUsers.forEach(username => {
    if (progressData[username]) {
      leaderboards.allTime.streakDays.push({
        username,
        value: progressData[username].streaks?.longest || randomInt(1, 14),
        timestamp: new Date().toISOString()
      });
    } else {
      leaderboards.allTime.streakDays.push({
        username,
        value: randomInt(1, 14),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  leaderboards.allTime.streakDays.sort((a, b) => b.value - a.value);
  
  // Generate weekly leaderboards
  // Copy from all-time but with different values
  
  // Weekly accuracy
  allUsers.forEach(username => {
    const allTimeEntry = leaderboards.allTime.accuracy.find(entry => entry.username === username);
    const baseValue = allTimeEntry ? allTimeEntry.value : randomFloat(70, 98, 1);
    
    // Weekly value is slightly different from all-time
    leaderboards.weekly.accuracy.push({
      username,
      value: Math.min(99.9, Math.max(50, baseValue + randomFloat(-5, 5, 1))),
      timestamp: new Date().toISOString()
    });
  });
  
  leaderboards.weekly.accuracy.sort((a, b) => b.value - a.value);
  
  // Weekly totalWords
  allUsers.forEach(username => {
    const allTimeEntry = leaderboards.allTime.totalWords.find(entry => entry.username === username);
    const baseValue = allTimeEntry ? allTimeEntry.value : randomInt(100, 1000);
    
    // Weekly value is much smaller than all-time
    leaderboards.weekly.totalWords.push({
      username,
      value: randomInt(10, Math.min(100, Math.floor(baseValue / 10))),
      timestamp: new Date().toISOString()
    });
  });
  
  leaderboards.weekly.totalWords.sort((a, b) => b.value - a.value);
  
  // Weekly sessionsCompleted
  allUsers.forEach(username => {
    const allTimeEntry = leaderboards.allTime.sessionsCompleted.find(entry => entry.username === username);
    const baseValue = allTimeEntry ? allTimeEntry.value : randomInt(5, 50);
    
    // Weekly value is much smaller than all-time
    leaderboards.weekly.sessionsCompleted.push({
      username,
      value: randomInt(1, Math.min(7, Math.floor(baseValue / 5))),
      timestamp: new Date().toISOString()
    });
  });
  
  leaderboards.weekly.sessionsCompleted.sort((a, b) => b.value - a.value);
  
  // Save the leaderboard data
  console.log('Saving leaderboard data...');
  writeJsonSafe(files.leaderboards, leaderboards);
  
  console.log('Leaderboard data generation complete!');
}

// Execute the script
generateLeaderboardData();
