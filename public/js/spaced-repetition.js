/**
 * Spaced Repetition System for Spelling Practice App
 * 
 * Based on the SM-2 algorithm (SuperMemo) with adaptations for spelling practice
 * This system schedules words for review based on user performance
 * Words are assigned difficulty levels and review intervals are adjusted accordingly
 */

// Global variables
let spacedRepetitionData = null;
let currentUser = null;
let currentWords = [];
let reviewQueue = [];

// Initialize the spaced repetition system
document.addEventListener('DOMContentLoaded', function() {
  // Event listener will be triggered when a user logs in
  document.addEventListener('userLoggedIn', function(e) {
    currentUser = e.detail.username;
    initializeSpacedRepetition(currentUser);
  });
});

// Main initialization function
async function initializeSpacedRepetition(username) {
  try {
    await fetchSpacedRepetitionData(username);
    updateSpacedRepetitionUI();
    console.log('🔄 Spaced repetition system initialized');
  } catch (error) {
    console.error('Error initializing spaced repetition:', error);
  }
}

// Fetch spaced repetition data for the current user
async function fetchSpacedRepetitionData(username) {
  try {
    const response = await fetch(`/getSpacedRepetitionData?username=${encodeURIComponent(username)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch spaced repetition data: ${response.status}`);
    }
    spacedRepetitionData = await response.json();
    
    // If there are words due for review today, add them to the review queue
    buildReviewQueue();
    
    return spacedRepetitionData;
  } catch (error) {
    console.error('Error fetching spaced repetition data:', error);
    return null;
  }
}

// Build a queue of words that are due for review
function buildReviewQueue() {
  if (!spacedRepetitionData || !spacedRepetitionData.words) {
    reviewQueue = [];
    return;
  }
  
  const today = new Date().toISOString().split('T')[0];
  reviewQueue = Object.entries(spacedRepetitionData.words)
    .filter(([_, wordData]) => {
      return wordData.nextReview && wordData.nextReview <= today;
    })
    .map(([word, wordData]) => ({
      word,
      easeFactor: wordData.easeFactor,
      interval: wordData.interval,
      repetitions: wordData.repetitions,
      lastReview: wordData.lastReview,
      nextReview: wordData.nextReview,
      priority: calculatePriority(wordData)
    }))
    .sort((a, b) => b.priority - a.priority); // Sort by priority (highest first)
}

// Calculate priority for a word based on how overdue it is and its difficulty
function calculatePriority(wordData) {
  if (!wordData.nextReview) return 0;
  
  const today = new Date();
  const nextReview = new Date(wordData.nextReview);
  const daysOverdue = Math.max(0, (today - nextReview) / (1000 * 60 * 60 * 24));
  
  // Priority increases with days overdue and decreases with ease factor
  // This prioritizes difficult, overdue words
  return daysOverdue * (5 - wordData.easeFactor);
}

// Update the UI to show spaced repetition information
function updateSpacedRepetitionUI() {
  const srStatsContainer = document.getElementById('srStatsContainer');
  if (!srStatsContainer || !spacedRepetitionData) return;
  
  // Clear previous content
  srStatsContainer.innerHTML = '';
  
  // Create stats container
  const statsDiv = document.createElement('div');
  statsDiv.className = 'sr-stats';
  
  const todayCount = reviewQueue.length;
  const masteredCount = Object.values(spacedRepetitionData.words || {})
    .filter(word => word.easeFactor >= 2.5 && word.repetitions >= 5).length;
  const totalCount = Object.keys(spacedRepetitionData.words || {}).length;
  
  statsDiv.innerHTML = `
    <div class="sr-stat-card">
      <div class="sr-stat-value">${todayCount}</div>
      <div class="sr-stat-label">Due Today</div>
    </div>
    <div class="sr-stat-card">
      <div class="sr-stat-value">${masteredCount}</div>
      <div class="sr-stat-label">Mastered</div>
    </div>
    <div class="sr-stat-card">
      <div class="sr-stat-value">${totalCount}</div>
      <div class="sr-stat-label">Total Words</div>
    </div>
  `;
  
  srStatsContainer.appendChild(statsDiv);
  
  // Update review button state
  const reviewButton = document.getElementById('startSpacedReviewBtn');
  if (reviewButton) {
    if (todayCount > 0) {
      reviewButton.classList.remove('disabled');
      reviewButton.innerHTML = `🔄 Start Review (${todayCount})`;
    } else {
      reviewButton.classList.add('disabled');
      reviewButton.innerHTML = '✓ All Caught Up';
    }
  }
  
  // Update progress visualization
  updateProgressVisualization();
}

// Update the progress visualization
function updateProgressVisualization() {
  const progressContainer = document.getElementById('srProgressContainer');
  if (!progressContainer || !spacedRepetitionData || !spacedRepetitionData.words) return;
  
  // Clear previous content
  progressContainer.innerHTML = '';
  
  const words = Object.entries(spacedRepetitionData.words);
  if (words.length === 0) {
    progressContainer.innerHTML = '<p>No words in your spaced repetition system yet.</p>';
    return;
  }
  
  // Create progress visualization
  const progressDiv = document.createElement('div');
  progressDiv.className = 'sr-progress-visualization';
  
  // Group words by mastery level
  const levels = {
    'New': words.filter(([_, w]) => w.repetitions === 0).length,
    'Learning': words.filter(([_, w]) => w.repetitions > 0 && w.repetitions < 3).length,
    'Reviewing': words.filter(([_, w]) => w.repetitions >= 3 && w.repetitions < 5).length,
    'Mastered': words.filter(([_, w]) => w.repetitions >= 5).length
  };
  
  const totalWords = Object.values(levels).reduce((sum, count) => sum + count, 0);
  
  // Create progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'sr-progress-bar';
  
  const colors = {
    'New': '#ff6b6b',
    'Learning': '#feca57',
    'Reviewing': '#54a0ff',
    'Mastered': '#1dd1a1'
  };
  
  Object.entries(levels).forEach(([level, count]) => {
    if (count === 0) return;
    
    const percentage = (count / totalWords) * 100;
    const segment = document.createElement('div');
    segment.className = 'sr-progress-segment';
    segment.style.width = `${percentage}%`;
    segment.style.backgroundColor = colors[level];
    segment.title = `${level}: ${count} words (${percentage.toFixed(1)}%)`;
    
    progressBar.appendChild(segment);
  });
  
  // Create legend
  const legend = document.createElement('div');
  legend.className = 'sr-legend';
  
  Object.entries(levels).forEach(([level, count]) => {
    const legendItem = document.createElement('div');
    legendItem.className = 'sr-legend-item';
    
    legendItem.innerHTML = `
      <span class="sr-legend-color" style="background-color: ${colors[level]}"></span>
      <span class="sr-legend-label">${level}: ${count}</span>
    `;
    
    legend.appendChild(legendItem);
  });
  
  progressDiv.appendChild(progressBar);
  progressDiv.appendChild(legend);
  progressContainer.appendChild(progressDiv);
}

// Start a spaced repetition review session
async function startSpacedReview() {
  if (reviewQueue.length === 0) {
    showToast('No words to review right now!', 'info');
    return;
  }
  
  // Hide student panel and show game section
  document.getElementById('studentPanel').classList.add('hidden');
  document.getElementById('gameSection').classList.remove('hidden');
  
  // Update UI to indicate this is a spaced repetition session
  document.querySelector('#gameSection h3').textContent = '🔄 Spaced Repetition Review';
  
  // Prepare words for the session (take up to 10 words from the queue)
  currentWords = reviewQueue.slice(0, 10).map(item => item.word);
  
  // Start the game with these words
  await startGame(currentWords, true);
}

// Process results from a spaced repetition session
function processSpacedRepetitionResults(results) {
  if (!currentUser || !spacedRepetitionData || !results || results.length === 0) return;
  
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Process each word from the results
  results.forEach(result => {
    const word = result.word;
    const correct = result.correct;
    
    // If word doesn't exist in the system yet, initialize it
    if (!spacedRepetitionData.words[word]) {
      spacedRepetitionData.words[word] = {
        easeFactor: 2.5, // Initial ease factor
        interval: 0,     // Initial interval (0 = first time)
        repetitions: 0,  // Number of successful reviews
        lastReview: null,
        nextReview: null
      };
    }
    
    const wordData = spacedRepetitionData.words[word];
    
    // Apply SM-2 algorithm
    if (correct) {
      // Update based on correct answer
      if (wordData.repetitions === 0) {
        // First successful review
        wordData.interval = 1;
      } else if (wordData.repetitions === 1) {
        // Second successful review
        wordData.interval = 6;
      } else {
        // Subsequent successful reviews - increase interval
        wordData.interval = Math.round(wordData.interval * wordData.easeFactor);
      }
      
      // Increment repetitions counter
      wordData.repetitions += 1;
      
      // Adjust ease factor (make it slightly easier if correct)
      wordData.easeFactor = Math.max(1.3, wordData.easeFactor + 0.1);
    } else {
      // Reset on incorrect answer
      wordData.repetitions = 0;
      wordData.interval = 1;
      
      // Make it harder if incorrect
      wordData.easeFactor = Math.max(1.3, wordData.easeFactor - 0.2);
    }
    
    // Update review dates
    wordData.lastReview = today;
    
    // Calculate next review date
    const nextDate = new Date(now);
    nextDate.setDate(nextDate.getDate() + wordData.interval);
    wordData.nextReview = nextDate.toISOString().split('T')[0];
  });
  
  // Save updated data to the server
  saveSpacedRepetitionData();
  
  // Update the queue and UI
  buildReviewQueue();
  updateSpacedRepetitionUI();
}

// Save the updated spaced repetition data to the server
async function saveSpacedRepetitionData() {
  if (!currentUser || !spacedRepetitionData) return;
  
  try {
    const response = await fetch('/updateSpacedRepetitionData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: currentUser,
        data: spacedRepetitionData
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update spaced repetition data: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving spaced repetition data:', error);
    return false;
  }
}

// Import new words to the spaced repetition system from a word list
async function importWordsToSR() {
  if (!currentUser || !spacedRepetitionData) return;
  
  try {
    // Get user's word lists
    const response = await fetch(`/getWordlistsForUser?username=${encodeURIComponent(currentUser)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch wordlists: ${response.status}`);
    }
    
    const wordlists = await response.json();
    if (!wordlists || !Array.isArray(wordlists) || wordlists.length === 0) {
      showToast('No word lists found', 'error');
      return;
    }
    
    // For simplicity, let's import all words from the user's word list
    const allWords = [...new Set(wordlists)]; // Remove duplicates
    
    // Add each word to the spaced repetition system if not already present
    let newWordsCount = 0;
    allWords.forEach(word => {
      if (!spacedRepetitionData.words[word]) {
        spacedRepetitionData.words[word] = {
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          lastReview: null,
          nextReview: new Date().toISOString().split('T')[0] // Due immediately
        };
        newWordsCount++;
      }
    });
    
    // Save the updated data
    await saveSpacedRepetitionData();
    
    // Update UI
    buildReviewQueue();
    updateSpacedRepetitionUI();
    
    showToast(`Added ${newWordsCount} new words to your spaced repetition system`, 'success');
  } catch (error) {
    console.error('Error importing words:', error);
    showToast('Failed to import words', 'error');
  }
}

// Export functions to window for use in HTML
window.startSpacedReview = startSpacedReview;
window.importWordsToSR = importWordsToSR;

// Register a handler for when game results are available
document.addEventListener('gameResultsAvailable', function(e) {
  // Only process if this was a spaced repetition session
  if (e.detail.isSpacedRepetition) {
    processSpacedRepetitionResults(e.detail.results);
  }
});
