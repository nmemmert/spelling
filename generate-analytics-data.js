/**
 * Generate sample analytics data for the Spelling Practice App
 * This script will add realistic user activity data to showcase the analytics features
 */

const fs = require('fs');
const path = require('path');

// Define paths
const DATA_DIR = path.join(__dirname, 'data');
const files = {
  users: path.join(DATA_DIR, 'users.json'),
  results: path.join(DATA_DIR, 'results.json'),
  progress: path.join(DATA_DIR, 'progress.json'),
  leaderboards: path.join(DATA_DIR, 'leaderboards.json'),
  challenges: path.join(DATA_DIR, 'challenges.json')
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

function generateTimeOfDay() {
  const hours = randomInt(8, 20).toString().padStart(2, '0');
  const minutes = randomInt(0, 59).toString().padStart(2, '0');
  const seconds = randomInt(0, 59).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// Main function to generate analytics data
async function generateAnalyticsData() {
  console.log('Generating sample analytics data...');
  
  // Load users
  const users = readJsonSafe(files.users, []);
  if (users.length === 0) {
    console.error('No users found. Please ensure users exist before running this script.');
    return;
  }
  
  // Generate data for each user
  const usernames = users.map(user => user.username);
  
  // Generate 90 days of results data (covering 3 months)
  const today = new Date();
  
  // Load existing data
  const resultsData = readJsonSafe(files.results, {});
  const progressData = readJsonSafe(files.progress, {});
  
  // For each user, generate 90 days of activity
  for (const username of usernames) {
    console.log(`Generating data for user: ${username}`);
    
    // Initialize user results if not exists
    if (!resultsData[username]) {
      resultsData[username] = [];
    }
    
    // Initialize user progress if not exists
    if (!progressData[username]) {
      progressData[username] = {
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
          dates: []
        },
        challengesCompleted: {
          daily: [],
          weekly: [],
          achievements: []
        },
        activityLog: []
      };
    }
    
    // Track total stats
    let totalSessions = 0;
    let totalWords = 0;
    let totalCorrect = 0;
    let streakDates = [];
    let activityLog = [];
    let points = randomInt(100, 500);
    
    // Generate 90 days of activity with increasing frequency towards present day
    for (let daysAgo = 90; daysAgo >= 0; daysAgo--) {
      const activityDate = subtractDays(today, daysAgo);
      const dateStr = formatDate(activityDate);
      
      // Determine likelihood of activity on this day
      // Higher chance of activity for more recent dates and on weekdays
      const dayOfWeek = activityDate.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const recencyFactor = 1 - (daysAgo / 90); // 0 to 1 from oldest to newest
      
      // Combine factors to determine chance of activity
      // 30% base chance + up to 50% recency bonus - 20% weekend penalty
      let activityChance = 0.3 + (recencyFactor * 0.5) - (isWeekend ? 0.2 : 0);
      
      // For user "nate", increase activity chance to ensure good data
      if (username === 'nate') {
        activityChance += 0.2;
      }
      
      // Determine if there's activity on this day
      if (Math.random() < activityChance) {
        // Record streak date
        streakDates.push(dateStr);
        
        // Determine number of sessions for this day (1-3)
        const sessionsToday = randomInt(1, username === 'nate' ? 3 : 2);
        
        for (let s = 0; s < sessionsToday; s++) {
          // Generate session ID
          const sessionId = `${username}-${dateStr}-${s}`;
          
          // Determine session details
          const numWords = randomInt(5, 15);
          
          // Base accuracy that improves over time due to learning
          let baseAccuracy = 0.65 + (recencyFactor * 0.2);
          
          // Add some randomness
          const accuracy = Math.min(0.98, baseAccuracy + randomFloat(-0.1, 0.1));
          
          // Calculate correct words
          const correctWords = Math.round(numWords * accuracy);
          
          // Generate random words
          const words = Array.from({length: numWords}, (_, i) => {
            const isCorrect = i < correctWords;
            return {
              word: `sample-word-${randomInt(1, 100)}`,
              correct: isCorrect
            };
          });
          
          // Create session result
          const sessionResult = {
            date: `${dateStr}T${generateTimeOfDay()}Z`,
            sessionId,
            total: numWords,
            correct: correctWords,
            score: Math.round(accuracy * 100),
            words
          };
          
          // Add to results
          resultsData[username].push(sessionResult);
          
          // Update totals
          totalSessions++;
          totalWords += numWords;
          totalCorrect += correctWords;
          
          // Add to activity log
          activityLog.push({
            type: 'session_completed',
            timestamp: `${dateStr}T${generateTimeOfDay()}Z`,
            details: {
              sessionId,
              score: Math.round(accuracy * 100),
              words: numWords
            }
          });
          
          // Occasionally add badge earning (1 in 10 sessions)
          if (Math.random() < 0.1) {
            const badges = [
              "Perfect Round", "Speed Demon", "Word Wizard", "Consistent Learner", 
              "Weekly Warrior", "Quick Study", "No Misses"
            ];
            const badge = badges[randomInt(0, badges.length - 1)];
            
            activityLog.push({
              type: 'badge_earned',
              timestamp: `${dateStr}T${generateTimeOfDay()}Z`,
              details: {
                badge,
                sessionId
              }
            });
            
            points += randomInt(10, 50);
          }
          
          // Occasionally add challenge completion (1 in 8 sessions)
          if (Math.random() < 0.125) {
            const challengeTypes = ['daily', 'weekly', 'achievements'];
            const challengeType = challengeTypes[randomInt(0, challengeTypes.length - 1)];
            const challengeId = `${challengeType}-${dateStr}-${randomInt(1, 5)}`;
            
            // Add to completed challenges
            if (!progressData[username].challengesCompleted[challengeType].includes(challengeId)) {
              progressData[username].challengesCompleted[challengeType].push(challengeId);
            }
            
            activityLog.push({
              type: 'challenge_completed',
              timestamp: `${dateStr}T${generateTimeOfDay()}Z`,
              details: {
                challengeId,
                challengeType,
                reward: {
                  points: randomInt(10, 50)
                }
              }
            });
            
            points += randomInt(20, 100);
          }
        }
      }
    }
    
    // Calculate streak stats
    const streakDays = streakDates.length;
    const currentStreak = calculateCurrentStreak(streakDates, today);
    const longestStreak = calculateLongestStreak(streakDates);
    
    // Update progress data with calculated stats
    progressData[username].stats = {
      points,
      totalSessions,
      totalWords,
      correctWords: totalCorrect,
      accuracy: totalWords > 0 ? Math.round((totalCorrect / totalWords) * 1000) / 10 : 0
    };
    
    progressData[username].streaks = {
      current: currentStreak,
      longest: longestStreak,
      dates: streakDates
    };
    
    progressData[username].activityLog = activityLog;
  }
  
  // Save updated data
  console.log('Saving updated results data...');
  writeJsonSafe(files.results, resultsData);
  
  console.log('Saving updated progress data...');
  writeJsonSafe(files.progress, progressData);
  
  console.log('Sample data generation complete!');
}

// Helper to calculate current streak
function calculateCurrentStreak(dates, today) {
  if (!dates || dates.length === 0) return 0;
  
  // Convert dates to Date objects for easier comparison
  const sortedDates = [...dates].map(d => new Date(d)).sort((a, b) => b - a);
  
  // Check if today is included
  const todayStr = formatDate(today);
  const hasTodayActivity = dates.includes(todayStr);
  
  if (!hasTodayActivity) {
    // Check if yesterday is included
    const yesterday = subtractDays(today, 1);
    const yesterdayStr = formatDate(yesterday);
    const hasYesterdayActivity = dates.includes(yesterdayStr);
    
    if (!hasYesterdayActivity) {
      return 0; // Streak broken if neither today nor yesterday has activity
    }
  }
  
  // Count consecutive days
  let streak = hasTodayActivity ? 1 : 0;
  let currentDate = hasTodayActivity ? subtractDays(today, 1) : subtractDays(today, 2);
  
  while (true) {
    const dateStr = formatDate(currentDate);
    if (!dates.includes(dateStr)) {
      break;
    }
    streak++;
    currentDate = subtractDays(currentDate, 1);
  }
  
  return streak;
}

// Helper to calculate longest streak
function calculateLongestStreak(dates) {
  if (!dates || dates.length === 0) return 0;
  
  // Convert dates to Date objects and sort
  const sortedDates = [...dates].map(d => new Date(d)).sort((a, b) => a - b);
  
  let longestStreak = 1;
  let currentStreak = 1;
  
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = sortedDates[i - 1];
    const currentDate = sortedDates[i];
    
    // Calculate difference in days
    const diffTime = currentDate.getTime() - prevDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      // Consecutive day
      currentStreak++;
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
    } else if (diffDays > 1) {
      // Streak broken
      currentStreak = 1;
    }
  }
  
  return longestStreak;
}

// Execute the script
generateAnalyticsData();
