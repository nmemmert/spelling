//Debug entry script to ensure the data directory and users exist

const fs = require('fs');
const path = require('path');

// Define directories
const DATA_DIR = path.join(__dirname, 'data');
const SEED_DIR = path.join(__dirname, 'seed');

// Define files
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

console.log('🔍 DEBUG: Starting debug script');
console.log(`📁 DATA_DIR: ${DATA_DIR}`);
console.log(`📁 SEED_DIR: ${SEED_DIR}`);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  console.log(`📁 Creating data directory: ${DATA_DIR}`);
  fs.mkdirSync(DATA_DIR);
}

// Helper function to read JSON safely
function readJsonSafe(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.error(`⚠️ Error reading ${filePath}: ${error.message}`);
    return fallback;
  }
}

// Ensure all data files exist, using seeds if available
Object.entries(files).forEach(([key, filename]) => {
  const targetPath = path.join(DATA_DIR, filename);
  const seedPath = path.join(SEED_DIR, filename);
  
  console.log(`🔍 Checking ${filename}...`);
  
  if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, 'utf-8').trim() === '') {
    console.log(`⚠️ ${filename} is missing or empty`);
    
    if (fs.existsSync(seedPath)) {
      console.log(`🌱 Using seed from ${seedPath}`);
      fs.copyFileSync(seedPath, targetPath);
      console.log(`✅ Created ${filename} from seed`);
    } else {
      console.log(`⚠️ No seed found for ${filename}`);
      
      // Create default structure for each file
      if (filename === 'users.json') {
        console.log(`👥 Creating default users`);
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
        console.log(`✅ Created ${filename} with default users`);
      } else {
        // For other files, create empty structure
        fs.writeFileSync(targetPath, JSON.stringify({}), 'utf-8');
        console.log(`✅ Created empty ${filename}`);
      }
    }
  } else {
    // Validate JSON format
    try {
      const content = fs.readFileSync(targetPath, 'utf-8');
      JSON.parse(content);
      console.log(`✅ ${filename} exists and is valid JSON`);
    } catch (error) {
      console.error(`🔴 ERROR: ${filename} contains invalid JSON: ${error.message}`);
      console.log(`🔄 Attempting to fix or replace ${filename}`);
      
      if (fs.existsSync(seedPath)) {
        fs.copyFileSync(seedPath, targetPath);
        console.log(`🛠️ Replaced with seed copy`);
      } else {
        fs.writeFileSync(targetPath, JSON.stringify({}), 'utf-8');
        console.log(`🛠️ Replaced with empty JSON object`);
      }
    }
  }
});

// Start the server
console.log('🚀 Starting server...');
require('./server.js');
