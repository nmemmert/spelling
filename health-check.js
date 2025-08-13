// Health check script for the Spelling Practice app
// Run this to verify all the fixes are working properly

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('🔍 Running health check...');

// Define directories and files
const DATA_DIR = path.join(__dirname, 'data');
const SEED_DIR = path.join(__dirname, 'seed');
const PUBLIC_DIR = path.join(__dirname, 'public');
const JS_DIR = path.join(PUBLIC_DIR, 'js');

const files = {
  users: path.join(DATA_DIR, 'users.json'),
  wordlists: path.join(DATA_DIR, 'wordlists.json'),
  results: path.join(DATA_DIR, 'results.json'),
  badges: path.join(DATA_DIR, 'badges.json'),
  leaderboards: path.join(DATA_DIR, 'leaderboards.json'),
  challenges: path.join(DATA_DIR, 'challenges.json'),
  progress: path.join(DATA_DIR, 'progress.json'),
  spacedRepetition: path.join(DATA_DIR, 'spacedRepetition.json')
};

// Check directories
console.log('📁 Checking directories...');
[DATA_DIR, PUBLIC_DIR, JS_DIR].forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${path.basename(dir)} directory exists`);
  } else {
    console.error(`❌ ${path.basename(dir)} directory is missing!`);
  }
});

// Check required data files
console.log('\n🗃️ Checking data files...');
Object.entries(files).forEach(([name, filePath]) => {
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      if (name === 'users') {
        console.log(`✅ ${name}: Found ${data.length} users: ${data.map(u => u.username).join(', ')}`);
      } else {
        console.log(`✅ ${name}: Valid JSON (${content.length} bytes)`);
      }
    } catch (e) {
      console.error(`❌ ${name}: Invalid JSON - ${e.message}`);
    }
  } else {
    console.error(`❌ ${name}: File not found!`);
  }
});

// Check critical JS files
console.log('\n📜 Checking JS files...');
const jsFiles = [
  'admin.js', 'analytics.js', 'auth.js', 'game.js', 'main.js', 
  'ui.js', 'init.js', 'debug-analytics.js'
];

jsFiles.forEach(file => {
  const filePath = path.join(JS_DIR, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log(`✅ ${file}: ${content.length} bytes`);
    
    // Look for specific fixed patterns
    if (file === 'admin.js') {
      if (content.includes('window.adminUsers')) {
        console.log(`  ✅ admin.js: Global adminUsers variable found`);
      } else {
        console.warn(`  ⚠️ admin.js: Global adminUsers variable not found`);
      }
    }
    
    if (file === 'analytics.js') {
      if (content.includes('window.analyticsRefresh')) {
        console.log(`  ✅ analytics.js: Global analyticsRefresh function found`);
      } else {
        console.warn(`  ⚠️ analytics.js: Global analyticsRefresh function not found`);
      }
    }
    
    if (file === 'ui.js') {
      if (content.includes('window.switchTab')) {
        console.log(`  ✅ ui.js: Global switchTab function found`);
      } else {
        console.warn(`  ⚠️ ui.js: Global switchTab function not found`);
      }
    }
  } else {
    console.error(`❌ ${file}: File not found!`);
  }
});

// Check package.json
console.log('\n📦 Checking package.json...');
const pkgPath = path.join(__dirname, 'package.json');
if (fs.existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    console.log(`✅ Package name: ${pkg.name}`);
    console.log(`✅ Version: ${pkg.version}`);
    console.log(`✅ Dependencies: ${Object.keys(pkg.dependencies || {}).length}`);
  } catch (e) {
    console.error(`❌ Invalid package.json: ${e.message}`);
  }
} else {
  console.error('❌ package.json not found!');
}

console.log('\n🏁 Health check complete!');
console.log('To test the application, run node server.js and open http://localhost:3000');
