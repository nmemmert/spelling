/**
 * Gamification features for Spelling Practice App
 * - Leaderboards
 * - Challenges & Achievements
 * - Streaks
 * - Points system
 */

// Global variables for gamification
let userProgress = null;
let challenges = null;
let leaderboards = null;
let currentUser = null;

// Initialize gamification features
document.addEventListener('DOMContentLoaded', function() {
  // Event listener will be triggered when a user logs in
  document.addEventListener('userLoggedIn', function(e) {
    currentUser = e.detail.username;
    initGamification(currentUser);
  });
});

// Main initialization function for gamification
async function initGamification(username) {
  try {
    // Fetch all required data
    await Promise.all([
      fetchUserProgress(username),
      fetchChallenges(),
      fetchLeaderboards()
    ]);
    
    // Update streak (marks user as active today)
    await updateUserStreak(username);
    
    // Render all gamification components
    renderStreakIndicator();
    renderUserStats();
    renderChallenges();
    renderLeaderboards();
    
    console.log('🎮 Gamification features initialized');
  } catch (error) {
    console.error('Error initializing gamification:', error);
  }
}

// Fetch user progress data
async function fetchUserProgress(username) {
  try {
    const response = await fetch(`/getUserProgress?username=${encodeURIComponent(username)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch user progress: ${response.status}`);
    }
    userProgress = await response.json();
    return userProgress;
  } catch (error) {
    console.error('Error fetching user progress:', error);
    return null;
  }
}

// Fetch challenges data
async function fetchChallenges() {
  try {
    const response = await fetch('/getChallenges');
    if (!response.ok) {
      throw new Error(`Failed to fetch challenges: ${response.status}`);
    }
    challenges = await response.json();
    return challenges;
  } catch (error) {
    console.error('Error fetching challenges:', error);
    return null;
  }
}

// Fetch leaderboards data
async function fetchLeaderboards() {
  try {
    const response = await fetch('/getLeaderboards');
    if (!response.ok) {
      throw new Error(`Failed to fetch leaderboards: ${response.status}`);
    }
    leaderboards = await response.json();
    return leaderboards;
  } catch (error) {
    console.error('Error fetching leaderboards:', error);
    return null;
  }
}

// Update user streak
async function updateUserStreak(username) {
  try {
    const response = await fetch('/updateStreak', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update streak: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Update local data
    if (userProgress) {
      userProgress.streaks = result.streak;
    }
    
    return result;
  } catch (error) {
    console.error('Error updating streak:', error);
    return null;
  }
}

// Complete a challenge
async function completeChallenge(challengeId, challengeType) {
  if (!currentUser) {
    console.error('No user logged in');
    return;
  }
  
  try {
    const response = await fetch('/completeChallenge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: currentUser,
        challengeId,
        challengeType
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to complete challenge: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Update local data
    userProgress = result.updatedProgress;
    
    // Update UI
    renderUserStats();
    renderChallenges();
    
    // Show success message
    showToast('Challenge completed!', 'success');
    
    return result;
  } catch (error) {
    console.error('Error completing challenge:', error);
    showToast('Failed to complete challenge', 'error');
    return null;
  }
}

// Render streak indicator in student panel
function renderStreakIndicator() {
  const streakContainer = document.getElementById('streakContainer');
  if (!streakContainer || !userProgress) return;
  
  // Clear previous content
  streakContainer.innerHTML = '';
  
  const currentStreak = userProgress.streaks.current || 0;
  
  // Create streak element
  const streakEl = document.createElement('div');
  streakEl.className = 'streak-container';
  
  streakEl.innerHTML = `
    <div class="streak-flame">🔥</div>
    <div class="streak-info">
      <div class="streak-days">${currentStreak} Day${currentStreak === 1 ? '' : 's'}</div>
      <div class="streak-subtitle">${currentStreak > 0 ? 'Current streak' : 'Start your streak today!'}</div>
      <div class="streak-progress">
        ${Array.from({ length: 7 }, (_, i) => 
          `<div class="streak-day${i < currentStreak ? ' active' : ''}"></div>`
        ).join('')}
      </div>
    </div>
    <div class="streak-record">
      <div class="streak-subtitle">Best</div>
      <div class="streak-best">${userProgress.streaks.longest || 0}</div>
    </div>
  `;
  
  streakContainer.appendChild(streakEl);
}

// Render user stats in student panel
function renderUserStats() {
  const statsContainer = document.getElementById('userStatsContainer');
  if (!statsContainer || !userProgress) return;
  
  // Clear previous content
  statsContainer.innerHTML = '';
  
  // Create stats container
  const statsEl = document.createElement('div');
  statsEl.className = 'user-stats';
  
  // Add stat cards
  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${userProgress.stats.points || 0}</div>
      <div class="stat-label">Points</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${userProgress.stats.accuracy ? userProgress.stats.accuracy.toFixed(1) + '%' : '0%'}</div>
      <div class="stat-label">Accuracy</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${userProgress.stats.totalSessions || 0}</div>
      <div class="stat-label">Sessions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${userProgress.stats.totalWords || 0}</div>
      <div class="stat-label">Words</div>
    </div>
  `;
  
  statsContainer.appendChild(statsEl);
}

// Render challenges in student panel
function renderChallenges() {
  const challengesContainer = document.getElementById('challengesContainer');
  if (!challengesContainer || !challenges || !userProgress) return;
  
  // Clear previous content
  challengesContainer.innerHTML = '';
  
  // Create challenges container
  const challengesEl = document.createElement('div');
  challengesEl.className = 'challenges-container';
  
  // Daily challenge
  if (challenges.daily && challenges.daily.current) {
    const dailyChallenge = challenges.daily.current;
    const isCompleted = userProgress.challengesCompleted.daily.includes(dailyChallenge.id);
    
    challengesEl.appendChild(createChallengeCard(dailyChallenge, 'daily', isCompleted));
  }
  
  // Weekly challenge
  if (challenges.weekly && challenges.weekly.current) {
    const weeklyChallenge = challenges.weekly.current;
    const isCompleted = userProgress.challengesCompleted.weekly.includes(weeklyChallenge.id);
    
    challengesEl.appendChild(createChallengeCard(weeklyChallenge, 'weekly', isCompleted));
  }
  
  // Achievement challenges (show only 3 unearned ones)
  if (challenges.achievements && challenges.achievements.length > 0) {
    const uncompletedAchievements = challenges.achievements
      .filter(achievement => !userProgress.challengesCompleted.achievements.includes(achievement.id))
      .slice(0, 3);
    
    uncompletedAchievements.forEach(achievement => {
      challengesEl.appendChild(createChallengeCard(achievement, 'achievement', false));
    });
  }
  
  challengesContainer.appendChild(challengesEl);
}

// Create a challenge card element
function createChallengeCard(challenge, type, isCompleted) {
  const card = document.createElement('div');
  card.className = `challenge-card ${type}`;
  card.dataset.id = challenge.id;
  
  // Calculate progress for the challenge
  let progress = 0;
  let progressText = '';
  
  switch (challenge.type) {
    case 'accuracy':
      progress = userProgress.stats.accuracy ? Math.min(userProgress.stats.accuracy / challenge.target, 1) : 0;
      progressText = `${userProgress.stats.accuracy ? userProgress.stats.accuracy.toFixed(1) : 0}% / ${challenge.target}%`;
      break;
    case 'words':
    case 'correctWords':
      progress = Math.min(userProgress.stats.correctWords / challenge.target, 1);
      progressText = `${userProgress.stats.correctWords || 0} / ${challenge.target}`;
      break;
    case 'sessions':
      progress = Math.min(userProgress.stats.totalSessions / challenge.target, 1);
      progressText = `${userProgress.stats.totalSessions || 0} / ${challenge.target}`;
      break;
    case 'streak':
      progress = Math.min(userProgress.streaks.current / challenge.target, 1);
      progressText = `${userProgress.streaks.current || 0} / ${challenge.target}`;
      break;
    case 'perfectSessions':
      // Would need to track this separately
      progress = 0;
      progressText = `0 / ${challenge.target}`;
      break;
  }
  
  // Format date for challenge time period
  let timeframe = '';
  if (type === 'daily') {
    timeframe = `Today (${new Date(challenge.date).toLocaleDateString()})`;
  } else if (type === 'weekly') {
    timeframe = `${new Date(challenge.startDate).toLocaleDateString()} - ${new Date(challenge.endDate).toLocaleDateString()}`;
  }
  
  card.innerHTML = `
    <div class="challenge-header">
      <h3 class="challenge-title">${challenge.title}</h3>
      <span class="challenge-badge ${type}">${
        type === 'daily' ? 'Daily'
        : type === 'weekly' ? 'Weekly'
        : 'Achievement'
      }</span>
    </div>
    <div class="challenge-description">${challenge.description}</div>
    <div class="challenge-progress">
      <div class="progress-bar-container">
        <div class="progress-bar-fill ${type}" style="width: ${Math.round(progress * 100)}%"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
        <span>${progressText}</span>
        <span>${Math.round(progress * 100)}%</span>
      </div>
    </div>
    <div class="challenge-footer">
      <div class="challenge-meta">
        ${timeframe ? `<div>${timeframe}</div>` : ''}
        <div class="challenge-reward">
          <span>Reward:</span>
          <span class="challenge-points">+${challenge.reward.points} pts</span>
          ${challenge.reward.badge ? `<span class="badge-icon">🏅 ${challenge.reward.badge}</span>` : ''}
        </div>
      </div>
      <button
        class="challenge-complete-btn${isCompleted ? ' completed' : progress >= 1 ? '' : ' locked'}"
        ${isCompleted ? 'disabled' : ''}
        onclick="${isCompleted ? '' : progress >= 1 ? `completeChallenge('${challenge.id}', '${type === 'achievement' ? 'achievements' : type}')` : ''}"
      >
        ${isCompleted ? 'Completed ✓' : progress >= 1 ? 'Claim Reward' : 'In Progress...'}
      </button>
    </div>
  `;
  
  return card;
}

// Render leaderboards in student panel
function renderLeaderboards() {
  const leaderboardsContainer = document.getElementById('leaderboardsContainer');
  if (!leaderboardsContainer || !leaderboards) return;
  
  // Clear previous content
  leaderboardsContainer.innerHTML = '';
  
  // Create leaderboard container
  const leaderboardEl = document.createElement('div');
  leaderboardEl.className = 'leaderboard-container';
  
  // Create header with tabs
  const header = document.createElement('div');
  header.className = 'leaderboard-header';
  header.innerHTML = `
    <h3>Leaderboards</h3>
    <div class="leaderboard-tabs">
      <div class="leaderboard-tab active" data-category="accuracy">Accuracy</div>
      <div class="leaderboard-tab" data-category="totalWords">Words</div>
      <div class="leaderboard-tab" data-category="streakDays">Streaks</div>
    </div>
  `;
  
  leaderboardEl.appendChild(header);
  
  // Create leaderboard table container
  const tableContainer = document.createElement('div');
  tableContainer.id = 'leaderboardTableContainer';
  
  // Initially show accuracy leaderboard
  tableContainer.appendChild(createLeaderboardTable('accuracy'));
  
  leaderboardEl.appendChild(tableContainer);
  leaderboardsContainer.appendChild(leaderboardEl);
  
  // Add event listeners for tabs
  const tabs = header.querySelectorAll('.leaderboard-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      // Remove active class from all tabs
      tabs.forEach(t => t.classList.remove('active'));
      
      // Add active class to clicked tab
      this.classList.add('active');
      
      // Update table
      const category = this.dataset.category;
      tableContainer.innerHTML = '';
      tableContainer.appendChild(createLeaderboardTable(category));
    });
  });
}

// Create a leaderboard table for a specific category
function createLeaderboardTable(category) {
  const table = document.createElement('table');
  table.className = 'leaderboard-table';
  
  // Create table header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th class="leaderboard-rank">#</th>
      <th>User</th>
      <th class="leaderboard-value">${
        category === 'accuracy' ? 'Accuracy'
        : category === 'totalWords' ? 'Words'
        : category === 'sessionsCompleted' ? 'Sessions'
        : 'Streak Days'
      }</th>
    </tr>
  `;
  table.appendChild(thead);
  
  // Create table body
  const tbody = document.createElement('tbody');
  
  // Get leaderboard data
  const data = leaderboards.allTime[category] || [];
  
  if (data.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="3" style="text-align: center;">No data available</td>';
    tbody.appendChild(tr);
  } else {
    data.forEach((entry, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="leaderboard-rank">${index + 1}</td>
        <td>${entry.username}${entry.username === currentUser ? ' (You)' : ''}</td>
        <td class="leaderboard-value">${
          category === 'accuracy' ? entry.value.toFixed(1) + '%'
          : entry.value
        }</td>
      `;
      
      // Highlight current user
      if (entry.username === currentUser) {
        tr.style.backgroundColor = 'var(--primary-soft)';
      }
      
      tbody.appendChild(tr);
    });
  }
  
  table.appendChild(tbody);
  return table;
}

// Helper function to show toast messages
function showToast(message, type = 'info') {
  // Check if toast container exists
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  
  // Create toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Show toast with animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Expose functions to window for use in HTML
window.completeChallenge = completeChallenge;
