// Enhanced User Sessions handling

// Function to load user sessions with export functionality
window.loadUserSessions = async function(username) {
  if (!username) {
    document.getElementById('userSessionList').innerHTML = '';
    return;
  }
  
  try {
    const res = await fetch('/getResults');
    const results = await res.json();
    
    const userSessions = results[username];
    const sessionList = document.getElementById('userSessionList');
    sessionList.innerHTML = '';
    
    if (!userSessions || !Array.isArray(userSessions) || userSessions.length === 0) {
      sessionList.innerHTML = '<li style="padding: 1rem; text-align: center;">No sessions found.</li>';
      return;
    }
    
    userSessions.forEach((session, index) => {
      const date = new Date(session.timestamp || Date.now()).toLocaleString();
      const score = session.score || 0;
      const total = (session.answers && session.answers.length) || 0;
      const percent = total > 0 ? Math.round((score / total) * 100) : 0;
      
      const li = document.createElement('li');
      li.style = 'padding: 1rem; border-bottom: 1px solid var(--border);';
      li.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <strong>${date}</strong>
            <div>Score: ${score}/${total} (${percent}%)</div>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn-secondary" onclick="exportSessionReport('${username}', ${JSON.stringify(session).replace(/"/g, '&quot;')})">
              📄 Export
            </button>
            <button class="btn-primary" onclick="toggleSessionDetails(${index})">
              View Details
            </button>
          </div>
        </div>
        <div class="sessionDetails hidden" id="session${index}">
          <h4 style="margin-top: 1rem;">Words:</h4>
          <ul>
            ${session.answers ? session.answers.map(a => 
              `<li>${a.word} - ${a.correct ? '✅ Correct' : '❌ Incorrect'}</li>`
            ).join('') : ''}
          </ul>
        </div>
      `;
      
      sessionList.appendChild(li);
    });

    // Store the sessions in a global variable for export functionality
    window.currentUserSessions = {
      username,
      sessions: userSessions
    };

  } catch (error) {
    console.error("Error loading sessions:", error);
    document.getElementById('userSessionList').innerHTML = 
      '<li style="padding: 1rem; text-align: center; color: var(--error);">Error loading sessions.</li>';
  }
};

// Toggle session details view
window.toggleSessionDetails = function(sessionIndex) {
  const detailsDiv = document.getElementById(`session${sessionIndex}`);
  detailsDiv.classList.toggle('hidden');
};

// Export all sessions for current user as CSV
window.exportAllSessionsCSV = function() {
  if (!window.currentUserSessions || !window.currentUserSessions.sessions) {
    showToast('Please select a student first');
    return;
  }

  const { username, sessions } = window.currentUserSessions;
  
  // Create CSV content
  let csvContent = 'Date,Score,Total Words,Percentage,Words Correct,Words Incorrect\n';
  
  sessions.forEach(session => {
    const date = new Date(session.timestamp || Date.now()).toLocaleDateString();
    const score = session.score || 0;
    const total = (session.answers && session.answers.length) || 0;
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    
    // Count correct and incorrect words
    const correctWords = session.answers ? session.answers.filter(a => a.correct).length : 0;
    const incorrectWords = total - correctWords;
    
    csvContent += `${date},${score},${total},${percent}%,${correctWords},${incorrectWords}\n`;
  });
  
  // Create and download the CSV file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${username}_all_sessions.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('All sessions exported to CSV');
};
