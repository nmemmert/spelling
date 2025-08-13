// Gamification API endpoints for the Spelling Practice App

// 🏆 Get leaderboards
app.get('/getLeaderboards', (req, res) => {
  try {
    const leaderboards = readJsonSafe(path.join(DATA_DIR, files.leaderboards), {});
    res.json(leaderboards);
  } catch (error) {
    console.error('Error getting leaderboards:', error);
    res.status(500).send('Failed to get leaderboards');
  }
});

// 🎯 Get current challenges
app.get('/getChallenges', (req, res) => {
  try {
    const challenges = readJsonSafe(path.join(DATA_DIR, files.challenges), {});
    res.json(challenges);
  } catch (error) {
    console.error('Error getting challenges:', error);
    res.status(500).send('Failed to get challenges');
  }
});

// 📈 Get user progress
app.get('/getUserProgress', (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).send('Username is required');
    }
    
    const progress = readJsonSafe(path.join(DATA_DIR, files.progress), {});
    
    if (!progress[username]) {
      return res.status(404).send('User progress not found');
    }
    
    res.json(progress[username]);
  } catch (error) {
    console.error('Error getting user progress:', error);
    res.status(500).send('Failed to get user progress');
  }
});

// 📋 Get all users' progress
app.get('/getAllProgress', (req, res) => {
  try {
    const progress = readJsonSafe(path.join(DATA_DIR, files.progress), {});
    res.json(progress);
  } catch (error) {
    console.error('Error getting all progress data:', error);
    res.status(500).send('Failed to get progress data');
  }
});

// 🔄 Update user streak
app.post('/updateStreak', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).send('Username is required');
    }
    
    const progress = readJsonSafe(path.join(DATA_DIR, files.progress), {});
    
    if (!progress[username]) {
      return res.status(404).send('User progress not found');
    }
    
    const userProgress = progress[username];
    const now = new Date();
    const lastActivity = userProgress.streaks.lastActivity ? new Date(userProgress.streaks.lastActivity) : null;
    
    // If this is the first activity or it's a new day
    if (!lastActivity || !isToday(lastActivity)) {
      // Check if the streak continues (last activity was yesterday)
      if (lastActivity) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (isSameDay(lastActivity, yesterday)) {
          // Streak continues
          userProgress.streaks.current++;
        } else {
          // Streak broken
          userProgress.streaks.current = 1;
        }
      } else {
        // First activity
        userProgress.streaks.current = 1;
      }
      
      // Update longest streak if needed
      if (userProgress.streaks.current > userProgress.streaks.longest) {
        userProgress.streaks.longest = userProgress.streaks.current;
      }
      
      // Update last activity
      userProgress.streaks.lastActivity = now.toISOString();
      
      // Write updated progress
      fs.writeFileSync(path.join(DATA_DIR, files.progress), JSON.stringify(progress, null, 2));
      
      // Check for streak achievements
      checkStreakAchievements(username, userProgress.streaks.current);
    }
    
    res.json({ streak: userProgress.streaks });
  } catch (error) {
    console.error('Error updating streak:', error);
    res.status(500).send('Failed to update streak');
  }
});

// 📝 Complete challenge
app.post('/completeChallenge', (req, res) => {
  try {
    const { username, challengeId, challengeType } = req.body;
    if (!username || !challengeId || !challengeType) {
      return res.status(400).send('Username, challengeId, and challengeType are required');
    }
    
    // Valid challenge types
    if (!['daily', 'weekly', 'achievements'].includes(challengeType)) {
      return res.status(400).send('Invalid challenge type');
    }
    
    const progress = readJsonSafe(path.join(DATA_DIR, files.progress), {});
    const challenges = readJsonSafe(path.join(DATA_DIR, files.challenges), {});
    
    if (!progress[username]) {
      return res.status(404).send('User progress not found');
    }
    
    // Find the challenge
    let challenge = null;
    if (challengeType === 'achievements') {
      challenge = challenges.achievements?.find(c => c.id === challengeId);
    } else {
      challenge = challenges[challengeType]?.current?.id === challengeId 
        ? challenges[challengeType].current
        : challenges[challengeType]?.history?.find(c => c.id === challengeId);
    }
    
    if (!challenge) {
      return res.status(404).send('Challenge not found');
    }
    
    // Check if already completed
    if (progress[username].challengesCompleted[challengeType].includes(challengeId)) {
      return res.status(409).send('Challenge already completed');
    }
    
    // Mark as completed
    progress[username].challengesCompleted[challengeType].push(challengeId);
    
    // Award points
    if (challenge.reward && challenge.reward.points) {
      progress[username].stats.points += challenge.reward.points;
    }
    
    // Award badge if applicable
    if (challenge.reward && challenge.reward.badge) {
      const badges = readJsonSafe(path.join(DATA_DIR, files.badges), {});
      
      if (!badges[username]) {
        badges[username] = [];
      }
      
      if (!badges[username].includes(challenge.reward.badge)) {
        badges[username].push(challenge.reward.badge);
        fs.writeFileSync(path.join(DATA_DIR, files.badges), JSON.stringify(badges, null, 2));
      }
    }
    
    // Write updated progress
    fs.writeFileSync(path.join(DATA_DIR, files.progress), JSON.stringify(progress, null, 2));
    
    res.json({ 
      message: 'Challenge completed',
      updatedProgress: progress[username] 
    });
  } catch (error) {
    console.error('Error completing challenge:', error);
    res.status(500).send('Failed to complete challenge');
  }
});

// 🔄 Update leaderboards
app.post('/updateLeaderboards', (req, res) => {
  try {
    // This should be an admin-only endpoint
    const leaderboards = readJsonSafe(path.join(DATA_DIR, files.leaderboards), {});
    const progress = readJsonSafe(path.join(DATA_DIR, files.progress), {});
    
    // Update all-time leaderboards
    const accuracyLeaderboard = [];
    const wordsLeaderboard = [];
    const sessionsLeaderboard = [];
    const streaksLeaderboard = [];
    
    Object.entries(progress).forEach(([username, data]) => {
      if (data.stats.totalSessions > 0) {
        // Accuracy leaderboard
        accuracyLeaderboard.push({
          username,
          value: data.stats.accuracy,
          timestamp: new Date().toISOString()
        });
        
        // Words leaderboard
        wordsLeaderboard.push({
          username,
          value: data.stats.totalWords,
          timestamp: new Date().toISOString()
        });
        
        // Sessions leaderboard
        sessionsLeaderboard.push({
          username,
          value: data.stats.totalSessions,
          timestamp: new Date().toISOString()
        });
        
        // Streaks leaderboard
        streaksLeaderboard.push({
          username,
          value: data.streaks.current,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Sort and limit leaderboards
    leaderboards.allTime.accuracy = accuracyLeaderboard
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
      
    leaderboards.allTime.totalWords = wordsLeaderboard
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
      
    leaderboards.allTime.sessionsCompleted = sessionsLeaderboard
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
      
    leaderboards.allTime.streakDays = streaksLeaderboard
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    
    // TODO: Implement weekly leaderboard calculations
    
    leaderboards.lastUpdated = new Date().toISOString();
    
    // Write updated leaderboards
    fs.writeFileSync(path.join(DATA_DIR, files.leaderboards), JSON.stringify(leaderboards, null, 2));
    
    res.json({ message: 'Leaderboards updated successfully' });
  } catch (error) {
    console.error('Error updating leaderboards:', error);
    res.status(500).send('Failed to update leaderboards');
  }
});

// 🆕 Generate new daily challenge
app.post('/generateDailyChallenge', (req, res) => {
  try {
    const challenges = readJsonSafe(path.join(DATA_DIR, files.challenges), {});
    const today = new Date();
    const dayString = today.toISOString().split('T')[0];
    
    // Check if today's challenge already exists
    if (challenges.daily.current && challenges.daily.current.date === dayString) {
      return res.status(409).send('Today\'s challenge already exists');
    }
    
    // Move current challenge to history
    if (challenges.daily.current) {
      if (!challenges.daily.history) {
        challenges.daily.history = [];
      }
      challenges.daily.history.unshift(challenges.daily.current);
      
      // Limit history size
      if (challenges.daily.history.length > 30) {
        challenges.daily.history = challenges.daily.history.slice(0, 30);
      }
    }
    
    // Challenge types
    const challengeTypes = [
      {
        type: 'accuracy',
        description: 'Complete a spelling session with at least {target}% accuracy',
        target: Math.floor(Math.random() * 11) + 85, // 85-95% accuracy
        points: 50
      },
      {
        type: 'words',
        description: 'Spell {target} words correctly in one day',
        target: Math.floor(Math.random() * 16) + 10, // 10-25 words
        points: 40
      },
      {
        type: 'sessions',
        description: 'Complete {target} spelling sessions in one day',
        target: Math.floor(Math.random() * 3) + 2, // 2-4 sessions
        points: 60
      }
    ];
    
    // Choose random challenge type
    const challenge = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];
    
    // Create new challenge
    challenges.daily.current = {
      id: `daily-${dayString}`,
      title: `${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} Challenge`,
      description: challenge.description.replace('{target}', challenge.target),
      type: challenge.type,
      target: challenge.target,
      reward: {
        points: challenge.points,
        badge: null
      },
      date: dayString
    };
    
    challenges.lastUpdated = today.toISOString();
    
    // Write updated challenges
    fs.writeFileSync(path.join(DATA_DIR, files.challenges), JSON.stringify(challenges, null, 2));
    
    res.json({ message: 'Daily challenge generated', challenge: challenges.daily.current });
  } catch (error) {
    console.error('Error generating daily challenge:', error);
    res.status(500).send('Failed to generate daily challenge');
  }
});

// 🆕 Generate new weekly challenge
app.post('/generateWeeklyChallenge', (req, res) => {
  try {
    const challenges = readJsonSafe(path.join(DATA_DIR, files.challenges), {});
    const today = new Date();
    const weekNum = getWeekNumber(today);
    const yearNum = today.getFullYear();
    const weekId = `weekly-${yearNum}-${weekNum}`;
    
    // Check if this week's challenge already exists
    if (challenges.weekly.current && challenges.weekly.current.id === weekId) {
      return res.status(409).send('This week\'s challenge already exists');
    }
    
    // Move current challenge to history
    if (challenges.weekly.current) {
      if (!challenges.weekly.history) {
        challenges.weekly.history = [];
      }
      challenges.weekly.history.unshift(challenges.weekly.current);
      
      // Limit history size
      if (challenges.weekly.history.length > 12) {
        challenges.weekly.history = challenges.weekly.history.slice(0, 12);
      }
    }
    
    // Challenge types
    const challengeTypes = [
      {
        type: 'streak',
        description: 'Practice spelling for {target} consecutive days',
        target: Math.floor(Math.random() * 3) + 4, // 4-6 days
        points: 100,
        badge: 'Weekly Warrior'
      },
      {
        type: 'correctWords',
        description: 'Spell {target} words correctly this week',
        target: Math.floor(Math.random() * 51) + 75, // 75-125 words
        points: 150,
        badge: 'Word Master'
      },
      {
        type: 'perfectSessions',
        description: 'Complete {target} perfect spelling sessions this week',
        target: Math.floor(Math.random() * 3) + 2, // 2-4 sessions
        points: 200,
        badge: 'Perfect Form'
      }
    ];
    
    // Choose random challenge type
    const challenge = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];
    
    // Create new challenge
    challenges.weekly.current = {
      id: weekId,
      title: `Week ${weekNum} Challenge`,
      description: challenge.description.replace('{target}', challenge.target),
      type: challenge.type,
      target: challenge.target,
      reward: {
        points: challenge.points,
        badge: challenge.badge
      },
      startDate: getWeekStartDate(today).toISOString().split('T')[0],
      endDate: getWeekEndDate(today).toISOString().split('T')[0]
    };
    
    challenges.lastUpdated = today.toISOString();
    
    // Write updated challenges
    fs.writeFileSync(path.join(DATA_DIR, files.challenges), JSON.stringify(challenges, null, 2));
    
    res.json({ message: 'Weekly challenge generated', challenge: challenges.weekly.current });
  } catch (error) {
    console.error('Error generating weekly challenge:', error);
    res.status(500).send('Failed to generate weekly challenge');
  }
});

// Helper function to check for streak achievements
function checkStreakAchievements(username, currentStreak) {
  try {
    const challenges = readJsonSafe(path.join(DATA_DIR, files.challenges), {});
    const progress = readJsonSafe(path.join(DATA_DIR, files.progress), {});
    
    // Find streak-based achievements
    const streakAchievements = challenges.achievements.filter(
      a => a.type === 'streak' && a.condition === 'dailyLogin'
    );
    
    // Check if any achievement is unlocked by the current streak
    streakAchievements.forEach(achievement => {
      // If streak target met and not already completed
      if (currentStreak >= achievement.target && 
          !progress[username].challengesCompleted.achievements.includes(achievement.id)) {
        
        // Mark as completed
        progress[username].challengesCompleted.achievements.push(achievement.id);
        
        // Award points
        if (achievement.reward && achievement.reward.points) {
          progress[username].stats.points += achievement.reward.points;
        }
        
        // Award badge if applicable
        if (achievement.reward && achievement.reward.badge) {
          const badges = readJsonSafe(path.join(DATA_DIR, files.badges), {});
          
          if (!badges[username]) {
            badges[username] = [];
          }
          
          if (!badges[username].includes(achievement.reward.badge)) {
            badges[username].push(achievement.reward.badge);
            fs.writeFileSync(path.join(DATA_DIR, files.badges), JSON.stringify(badges, null, 2));
          }
        }
      }
    });
    
    // Write updated progress if needed
    fs.writeFileSync(path.join(DATA_DIR, files.progress), JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error('Error checking streak achievements:', error);
  }
}
