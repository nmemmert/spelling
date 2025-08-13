// Enhanced Analytics API endpoint for the Spelling Practice App

// Get analytics data with additional metrics
app.get('/getAnalytics', (req, res) => {
  try {
    const results = readJsonSafe(path.join(DATA_DIR, files.results), {});
    
    // Prepare analytics data structure
    const analytics = {
      summary: {
        totalSessions: 0,
        totalWords: 0,
        correctWords: 0,
        overallAccuracy: 0,
        averageScore: 0,
        mostMissedWords: [],
        activityByDate: {}
      },
      userStats: {},
      wordStats: {}
    };
    
    // Process all results data
    Object.keys(results).forEach(username => {
      // Skip if user has no results
      if (!Array.isArray(results[username]) || results[username].length === 0) return;
      
      // Initialize user stats if not already present
      if (!analytics.userStats[username]) {
        analytics.userStats[username] = {
          totalSessions: 0,
          totalWords: 0,
          correctWords: 0,
          accuracy: 0,
          averageScore: 0,
          trend: [], // For progress over time
          recentResults: [],
          problemWords: []
        };
      }
      
      // Process each session for this user
      results[username].forEach(session => {
        // Skip invalid sessions
        if (!session || !session.answers || !Array.isArray(session.answers)) return;
        
        // Update summary counts
        analytics.summary.totalSessions++;
        analytics.userStats[username].totalSessions++;
        
        // Process session date for activity tracking
        const sessionDate = new Date(session.timestamp || Date.now()).toISOString().split('T')[0];
        analytics.summary.activityByDate[sessionDate] = (analytics.summary.activityByDate[sessionDate] || 0) + 1;
        
        // Collect score for trending data
        if (typeof session.score === 'number' && session.answers.length > 0) {
          const accuracy = session.score / session.answers.length;
          analytics.userStats[username].trend.push({
            date: sessionDate,
            accuracy: accuracy * 100,
            score: session.score,
            total: session.answers.length
          });
        }
        
        // Keep only most recent 10 sessions for the trend data
        if (analytics.userStats[username].trend.length > 10) {
          analytics.userStats[username].trend = analytics.userStats[username].trend.slice(-10);
        }
        
        // Get the 5 most recent results for display
        if (analytics.userStats[username].recentResults.length < 5) {
          analytics.userStats[username].recentResults.push({
            date: new Date(session.timestamp || Date.now()).toLocaleString(),
            score: session.score,
            total: session.answers.length,
            completed: session.completed
          });
        }
        
        // Process individual words in the session
        session.answers.forEach(answer => {
          // Skip invalid answers
          if (!answer || typeof answer.word !== 'string') return;
          
          // Update word stats
          const word = answer.word.toLowerCase();
          
          if (!analytics.wordStats[word]) {
            analytics.wordStats[word] = {
              attempts: 0,
              correct: 0,
              incorrect: 0,
              accuracy: 0
            };
          }
          
          analytics.wordStats[word].attempts++;
          analytics.summary.totalWords++;
          analytics.userStats[username].totalWords++;
          
          if (answer.correct) {
            analytics.wordStats[word].correct++;
            analytics.summary.correctWords++;
            analytics.userStats[username].correctWords++;
          } else {
            analytics.wordStats[word].incorrect++;
            
            // Track problem words for this user
            const problemWordIndex = analytics.userStats[username].problemWords.findIndex(pw => pw.word === word);
            
            if (problemWordIndex >= 0) {
              analytics.userStats[username].problemWords[problemWordIndex].count++;
            } else {
              analytics.userStats[username].problemWords.push({
                word,
                count: 1
              });
            }
          }
          
          // Calculate accuracy for this word
          analytics.wordStats[word].accuracy = 
            analytics.wordStats[word].correct / analytics.wordStats[word].attempts * 100;
        });
        
        // Calculate user accuracy and average score
        analytics.userStats[username].accuracy = 
          analytics.userStats[username].correctWords / analytics.userStats[username].totalWords * 100 || 0;
        analytics.userStats[username].averageScore = 
          analytics.userStats[username].correctWords / analytics.userStats[username].totalSessions || 0;
      });
      
      // Sort problem words by count (descending)
      analytics.userStats[username].problemWords.sort((a, b) => b.count - a.count);
      
      // Keep only top 5 problem words
      analytics.userStats[username].problemWords = analytics.userStats[username].problemWords.slice(0, 5);
    });
    
    // Calculate overall metrics
    analytics.summary.overallAccuracy = 
      analytics.summary.correctWords / analytics.summary.totalWords * 100 || 0;
    analytics.summary.averageScore = 
      analytics.summary.correctWords / analytics.summary.totalSessions || 0;
    
    // Find most missed words (top 5)
    const missedWords = Object.keys(analytics.wordStats)
      .map(word => ({
        word,
        missCount: analytics.wordStats[word].incorrect
      }))
      .filter(item => item.missCount > 0)
      .sort((a, b) => b.missCount - a.missCount)
      .slice(0, 5);
    
    analytics.summary.mostMissedWords = missedWords;
    
    res.json(analytics);
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).send('Error generating analytics data');
  }
});
