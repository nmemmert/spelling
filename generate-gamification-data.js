/**
 * Generate sample gamification data for the Spelling Practice App
 * This script will populate challenges and user progress with realistic data
 */

const fs = require('fs');
const path = require('path');

// Define paths
const DATA_DIR = path.join(__dirname, 'data');
const files = {
  users: path.join(DATA_DIR, 'users.json'),
  challenges: path.join(DATA_DIR, 'challenges.json'),
  progress: path.join(DATA_DIR, 'progress.json')
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

// Date helpers
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function subtractDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

// Generate sample challenges
function generateChallenges() {
  const challenges = {
    daily: [
      {
        id: "daily-practice-10",
        name: "Practice Makes Perfect",
        description: "Complete 10 practice words in a day",
        type: "daily",
        target: 10,
        points: 50,
        icon: "🎯"
      },
      {
        id: "daily-accuracy-90",
        name: "Sharp Shooter",
        description: "Achieve 90% accuracy in daily practice",
        type: "daily",
        target: 0.9,
        points: 75,
        icon: "🎯"
      },
      {
        id: "daily-streak-3",
        name: "On Fire",
        description: "Get 3 words correct in a row",
        type: "daily",
        target: 3,
        points: 30,
        icon: "🔥"
      }
    ],
    weekly: [
      {
        id: "weekly-words-50",
        name: "Word Warrior",
        description: "Practice 50 words in a week",
        type: "weekly",
        target: 50,
        points: 200,
        icon: "⚔️"
      },
      {
        id: "weekly-days-5",
        name: "Dedicated Scholar",
        description: "Practice on 5 different days this week",
        type: "weekly",
        target: 5,
        points: 250,
        icon: "📚"
      }
    ],
    achievements: [
      {
        id: "achievement-words-100",
        name: "Century Club",
        description: "Practice 100 total words",
        type: "achievement",
        target: 100,
        points: 100,
        icon: "🏆"
      },
      {
        id: "achievement-words-500",
        name: "Word Master",
        description: "Practice 500 total words",
        type: "achievement",
        target: 500,
        points: 500,
        icon: "👑"
      },
      {
        id: "achievement-streak-7",
        name: "Weekly Warrior",
        description: "Maintain a 7-day practice streak",
        type: "achievement",
        target: 7,
        points: 300,
        icon: "📅"
      },
      {
        id: "achievement-accuracy-95",
        name: "Spelling Bee Champion",
        description: "Maintain 95% accuracy across 100 words",
        type: "achievement",
        target: 0.95,
        points: 400,
        icon: "🐝"
      }
    ]
  };

  return challenges;
}

// Generate progress data for a user
function generateUserProgress(username) {
  const today = new Date();
  
  // Generate streak data
  const currentStreak = randomInt(1, 14);
  const longestStreak = Math.max(currentStreak, randomInt(7, 21));
  
  // Generate points from challenges and achievements
  const totalPoints = randomInt(500, 2000);
  
  // Generate completed challenges
  const dailyChallenges = [];
  const weeklyChallenges = [];
  const achievements = [];
  
  // Generate some daily challenges for the past 14 days
  for (let i = 0; i < 14; i++) {
    const date = formatDate(subtractDays(today, i));
    
    // 70% chance to have completed some daily challenges
    if (Math.random() < 0.7) {
      // Random selection of daily challenges
      const dailyIds = ["daily-practice-10", "daily-accuracy-90", "daily-streak-3"];
      const completedCount = randomInt(1, dailyIds.length);
      
      for (let j = 0; j < completedCount; j++) {
        dailyChallenges.push({
          id: dailyIds[j],
          date,
          progress: 1.0 // 100% complete
        });
      }
    }
  }
  
  // Generate weekly challenges for the past 4 weeks
  for (let i = 0; i < 4; i++) {
    const weekStart = formatDate(subtractDays(today, 7 * (i + 1)));
    
    // 60% chance to have completed a weekly challenge
    if (Math.random() < 0.6) {
      const weeklyIds = ["weekly-words-50", "weekly-days-5"];
      const completedId = weeklyIds[randomInt(0, weeklyIds.length - 1)];
      
      weeklyChallenges.push({
        id: completedId,
        weekStart,
        progress: 1.0
      });
    }
  }
  
  // Generate achievements (randomly completed)
  const achievementIds = [
    "achievement-words-100",
    "achievement-words-500",
    "achievement-streak-7",
    "achievement-accuracy-95"
  ];
  
  // 30-70% of achievements completed
  const completedCount = randomInt(
    Math.floor(achievementIds.length * 0.3),
    Math.floor(achievementIds.length * 0.7)
  );
  
  for (let i = 0; i < completedCount; i++) {
    const achievementId = achievementIds[i];
    const daysAgo = randomInt(1, 30);
    
    achievements.push({
      id: achievementId,
      date: formatDate(subtractDays(today, daysAgo)),
      progress: 1.0
    });
  }
  
  // Overall user progress data
  return {
    streak: {
      current: currentStreak,
      longest: longestStreak,
      lastPractice: formatDate(subtractDays(today, 1)) // Yesterday
    },
    points: totalPoints,
    level: Math.floor(totalPoints / 500) + 1, // Level up every 500 points
    dailyChallenges,
    weeklyChallenges,
    achievements,
    stats: {
      wordsAttempted: randomInt(100, 1000),
      wordsCorrect: randomInt(70, 95) / 100 * randomInt(100, 1000),
      sessionsCompleted: randomInt(20, 100),
      averageAccuracy: randomInt(70, 98) / 100
    }
  };
}

// Main function to generate gamification data
async function generateGamificationData() {
  console.log('Generating sample gamification data...');
  
  // Load users
  const users = readJsonSafe(files.users, []);
  
  if (users.length === 0) {
    console.error('No users found. Please ensure users exist before running this script.');
    return;
  }
  
  // Generate challenges
  console.log('Generating challenges data...');
  const challenges = generateChallenges();
  
  // Generate progress for each user
  const progress = {};
  
  for (const user of users) {
    const username = user.username;
    console.log(`Generating progress data for user: ${username}`);
    progress[username] = generateUserProgress(username);
  }
  
  // Save data
  console.log('Saving challenges and progress data...');
  writeJsonSafe(files.challenges, challenges);
  writeJsonSafe(files.progress, progress);
  
  console.log('Gamification data generation complete!');
}

// Execute the script
generateGamificationData();
