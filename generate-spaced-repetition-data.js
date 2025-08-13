/**
 * Generate sample spaced repetition data for the Spelling Practice App
 * This script will populate the spaced repetition system with realistic learning data
 */

const fs = require('fs');
const path = require('path');

// Define paths
const DATA_DIR = path.join(__dirname, 'data');
const files = {
  users: path.join(DATA_DIR, 'users.json'),
  wordlists: path.join(DATA_DIR, 'wordlists.json'),
  spacedRepetition: path.join(DATA_DIR, 'spacedRepetition.json')
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

// Date helpers
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function subtractDays(date, days) {
  return addDays(date, -days);
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Main function to generate spaced repetition data
async function generateSpacedRepetitionData() {
  console.log('Generating sample spaced repetition data...');
  
  // Load users and wordlists
  const users = readJsonSafe(files.users, []);
  const wordlists = readJsonSafe(files.wordlists, {});
  
  if (users.length === 0) {
    console.error('No users found. Please ensure users exist before running this script.');
    return;
  }
  
  // Create spaced repetition data structure
  const srData = readJsonSafe(files.spacedRepetition, {});
  
  // Generate data for each user
  const today = new Date();
  
  for (const user of users) {
    const username = user.username;
    console.log(`Generating spaced repetition data for user: ${username}`);
    
    // Get user's words
    let userWords = [];
    
    // Handle different wordlist structures
    if (Array.isArray(wordlists[username])) {
      userWords = wordlists[username];
    } else if (wordlists[username] && wordlists[username].weeks && Array.isArray(wordlists[username].weeks)) {
      // Extract all words from all weeks
      wordlists[username].weeks.forEach(week => {
        if (week.words && Array.isArray(week.words)) {
          userWords = [...userWords, ...week.words];
        }
      });
    }
    
    if (userWords.length === 0) {
      console.log(`No words found for user ${username}. Skipping...`);
      continue;
    }
    
    // Initialize user's spaced repetition data if not exists
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
    }
    
    // Add words with different mastery levels
    let totalReviews = 0;
    let correctReviews = 0;
    let masteredWords = 0;
    
    for (const word of userWords) {
      // Determine mastery level
      // 0: New - 20%
      // 1-2: Learning - 30%
      // 3-4: Reviewing - 30%
      // 5+: Mastered - 20%
      
      const rand = Math.random();
      let repetitions = 0;
      let interval = 0;
      let easeFactor = 2.5;
      
      if (rand < 0.2) {
        // New word
        repetitions = 0;
        interval = 0;
        easeFactor = randomFloat(2.3, 2.7, 1);
      } else if (rand < 0.5) {
        // Learning
        repetitions = randomInt(1, 2);
        interval = repetitions === 1 ? 1 : 3;
        easeFactor = randomFloat(2.0, 2.5, 1);
        totalReviews += repetitions;
        correctReviews += repetitions - 1;
      } else if (rand < 0.8) {
        // Reviewing
        repetitions = randomInt(3, 4);
        interval = repetitions === 3 ? 7 : 15;
        easeFactor = randomFloat(2.2, 2.8, 1);
        totalReviews += repetitions;
        correctReviews += repetitions - 1;
      } else {
        // Mastered
        repetitions = randomInt(5, 8);
        interval = Math.pow(2, repetitions - 4) * 10; // Exponential increase
        easeFactor = randomFloat(2.6, 3.0, 1);
        totalReviews += repetitions;
        correctReviews += repetitions - 1;
        masteredWords++;
      }
      
      // Calculate last and next review dates
      let nextReview = null;
      let lastReview = null;
      
      if (repetitions > 0) {
        // If the word has been reviewed before, set lastReview
        lastReview = formatDate(subtractDays(today, randomInt(1, interval)));
        
        // Next review might be due
        const dueChance = 0.3; // 30% chance word is due
        if (Math.random() < dueChance) {
          // Word is due today or in the past
          nextReview = formatDate(subtractDays(today, randomInt(0, 3)));
        } else {
          // Word is due in the future
          nextReview = formatDate(addDays(today, randomInt(1, interval)));
        }
      } else {
        // New word, not reviewed yet
        nextReview = formatDate(today);
      }
      
      // Add word to user's SR data
      srData[username].words[word] = {
        easeFactor,
        interval,
        repetitions,
        lastReview,
        nextReview
      };
    }
    
    // Update user stats
    srData[username].stats = {
      totalReviews,
      correctReviews,
      totalWords: userWords.length,
      masteredWords
    };
  }
  
  // Save spaced repetition data
  console.log('Saving spaced repetition data...');
  writeJsonSafe(files.spacedRepetition, srData);
  
  console.log('Spaced repetition data generation complete!');
}

// Execute the script
generateSpacedRepetitionData();
