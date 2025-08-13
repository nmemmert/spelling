/**
 * Spaced Repetition System API endpoints for the Spelling Practice App
 */

module.exports = function(app, DATA_DIR, files, readJsonSafe, fs, path) {

// Get spaced repetition data
app.get('/getSpacedRepetitionData', (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Get spaced repetition data
    const srPath = path.join(DATA_DIR, files.spacedRepetition);
    const srData = readJsonSafe(srPath, {});
    
    // If user doesn't have data yet, initialize them
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
      
      // Save the new user data
      fs.writeFileSync(srPath, JSON.stringify(srData, null, 2));
      console.log(`📚 Initialized spaced repetition data for "${username}"`);
    }
    
    res.json(srData[username]);
  } catch (error) {
    console.error('Error getting spaced repetition data:', error);
    res.status(500).json({ error: 'Failed to get spaced repetition data' });
  }
});

// Get word lists for a user (for importing into spaced repetition)
app.get('/getWordlistsForUser', (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Get word lists
    const wordlistsPath = path.join(DATA_DIR, files.wordlists);
    const wordlists = readJsonSafe(wordlistsPath, {});
    
    // If user doesn't have a word list, return an empty array
    if (!wordlists[username]) {
      return res.json([]);
    }
    
    res.json(wordlists[username]);
  } catch (error) {
    console.error('Error getting wordlists for user:', error);
    res.status(500).json({ error: 'Failed to get wordlists' });
  }
});

// Update spaced repetition data
app.post('/updateSpacedRepetitionData', (req, res) => {
  try {
    const { username, data } = req.body;
    if (!username || !data) {
      return res.status(400).json({ error: 'Username and data are required' });
    }
    
    // Update data
    const srPath = path.join(DATA_DIR, files.spacedRepetition);
    const srData = readJsonSafe(srPath, {});
    
    // Update user data
    srData[username] = data;
    
    // Calculate stats
    const words = Object.values(data.words || {});
    data.stats = {
      totalReviews: words.reduce((sum, word) => sum + (word.repetitions || 0), 0),
      correctReviews: words.reduce((sum, word) => sum + ((word.repetitions > 0) ? word.repetitions - 1 : 0), 0),
      totalWords: words.length,
      masteredWords: words.filter(word => word.repetitions >= 5).length
    };
    
    // Save updated data
    fs.writeFileSync(srPath, JSON.stringify(srData, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating spaced repetition data:', error);
    res.status(500).json({ error: 'Failed to update spaced repetition data' });
  }
});

// Generate a spaced repetition review session
app.post('/generateSpacedRepetitionSession', (req, res) => {
  try {
    const { username, count = 10 } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Get spaced repetition data
    const srPath = path.join(DATA_DIR, files.spacedRepetition);
    const srData = readJsonSafe(srPath, {});
    
    // If user doesn't exist, return an error
    if (!srData[username]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = srData[username];
    const today = new Date().toISOString().split('T')[0];
    
    // Find words due for review
    const dueWords = Object.entries(userData.words || {})
      .filter(([_, wordData]) => wordData.nextReview && wordData.nextReview <= today)
      .map(([word, wordData]) => ({
        word,
        easeFactor: wordData.easeFactor,
        interval: wordData.interval,
        priority: calculatePriority(wordData, today)
      }))
      .sort((a, b) => b.priority - a.priority) // Sort by priority (highest first)
      .slice(0, count) // Take only the requested number of words
      .map(item => item.word);
    
    res.json({ words: dueWords });
  } catch (error) {
    console.error('Error generating spaced repetition session:', error);
    res.status(500).json({ error: 'Failed to generate session' });
  }
});

// Helper function to calculate priority for a word
function calculatePriority(wordData, today) {
  if (!wordData.nextReview) return 0;
  
  const nextReview = new Date(wordData.nextReview);
  const todayDate = new Date(today);
  const daysOverdue = Math.max(0, (todayDate - nextReview) / (1000 * 60 * 60 * 24));
  
  // Priority increases with days overdue and decreases with ease factor
  // This prioritizes difficult, overdue words
  return daysOverdue * (5 - wordData.easeFactor);
}

}; // Close the module.exports function

// Will be logged when the module is properly required
