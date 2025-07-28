// Ensure tab event listeners are attached after everything is defined
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const tabButtons = document.querySelectorAll('#adminTabs button');
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = button.getAttribute('data-tab');
        if (tabId && typeof window.switchTab === 'function') {
          window.switchTab(tabId);
        }
      });
    });
  }, 0);
});
// Global variables for admin functionality
// --- Weeks input logic ---
// Populate active week dropdown from weeksContainer
window.populateActiveWeekDropdown = function() {
  const select = document.getElementById('activeWeekSelect');
  select.innerHTML = '';
  document.querySelectorAll('#weeksContainer .week-input-card').forEach(card => {
    const date = card.querySelector('.week-date').value;
    if (date) {
      const option = document.createElement('option');
      option.value = date;
      option.textContent = date;
      select.appendChild(option);
    }
  });
};

// Call populateActiveWeekDropdown whenever weeks change
const observer = new MutationObserver(() => populateActiveWeekDropdown());
observer.observe(document.getElementById('weeksContainer'), { childList: true, subtree: true });

window.setActiveWeek = async function() {
  const selectedUser = document.getElementById('wordUserSelect')?.value;
  const activeWeek = document.getElementById('activeWeekSelect')?.value;
  if (!selectedUser || !activeWeek) {
    alert('⚠️ Please select a user and week.');
    return;
  }
  await fetch('/setActiveWeek', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: selectedUser, activeWeek })
  });
  alert(`✅ Active week set for ${selectedUser}: ${activeWeek}`);
}
window.addWeekInput = function() {
  const container = document.getElementById('weeksContainer');
  const weekIdx = container.children.length;
  const weekDiv = document.createElement('div');
  weekDiv.className = 'week-input-card';
  weekDiv.style = 'border:1px solid #ccc; padding:1rem; margin-bottom:1rem;';
  weekDiv.innerHTML = `
    <label>Date: <input type="date" class="week-date" /></label><br/>
    <textarea class="week-words" placeholder="Enter one word per line..."></textarea><br/>
    <button type="button" onclick="this.parentElement.remove()" class="btn-error" style="margin-top:0.5rem;">Remove Week</button>
  `;
  container.appendChild(weekDiv);
}

window.saveWeeks = async function() {
  const selectedUser = document.getElementById('wordUserSelect')?.value;
  if (!selectedUser) {
    alert('⚠️ Please select a user before saving.');
    return;
  }
  const weeks = [];
  document.querySelectorAll('#weeksContainer .week-input-card').forEach(card => {
    const date = card.querySelector('.week-date').value;
    const words = card.querySelector('.week-words').value.split('\n').map(w => w.trim()).filter(Boolean);
    if (date && words.length) {
      weeks.push({ date, words });
    }
  });
  if (!weeks.length) {
    alert('⚠️ Please enter at least one week with a date and words.');
    return;
  }
  await fetch('/saveWeeksWordList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: selectedUser, weeks })
  });
  alert(`✅ Weeks saved for ${selectedUser}`);
}

window.clearWeeks = function() {
  document.getElementById('weeksContainer').innerHTML = '';
}
let allWords = [];
let adminUsers = [];

// 🧭 Admin tab switcher (make it globally accessible)
window.switchTab = function switchTab(targetId) {
  console.log('🔄 Switching to tab:', targetId);
  
  // Hide all tabs
  document.querySelectorAll('.adminTab').forEach(tab => {
    tab.classList.add('hidden');
  });
  
  // Remove active class from all buttons
  document.querySelectorAll('#adminTabs button').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show the selected tab
  const targetTab = document.getElementById(targetId);
  if (targetTab) {
    targetTab.classList.remove('hidden');
    console.log('✅ Showing tab:', targetId);
  } else {
    console.error('❌ Tab not found:', targetId);
  }

  // Highlight the active button
  document.querySelectorAll('#adminTabs button').forEach(btn => {
    if (btn.getAttribute('data-tab') === targetId) {
      btn.classList.add('active');
    }
  });

  // 🔁 Trigger tab-specific logic
  switch(targetId) {
    case 'tabSessions':
      if (typeof populateSessionUserDropdown === 'function') {
        populateSessionUserDropdown();
      }
      const sessionList = document.getElementById("userSessionList");
      if (sessionList) sessionList.innerHTML = "";
      break;
    case 'tabReports':
      if (typeof loadStudentNamesForReport === 'function') {
        loadStudentNamesForReport();
      }
      break;
    case 'tabPasswords':
      populatePasswordUserDropdown();
      break;
    case 'tabBadges':
      if (typeof loadBadgeViewer === 'function') {
        loadBadgeViewer();
      }
      break;
    case 'tabAnalytics':
      if (typeof refreshAnalytics === 'function') {
        refreshAnalytics();
      }
      break;
    case 'tabResults':
      if (typeof loadStudentResults === 'function') {
        loadStudentResults();
      }
      break;
    case 'tabWords':
      loadUserDropdowns();
      break;
  }
  // Attach admin tab event listeners after switchTab is defined
  window.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('#adminTabs button');
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = button.getAttribute('data-tab');
        if (tabId) {
          window.switchTab(tabId);
        }
      });
    });
  });
};

// Load users from server
async function loadUsers() {
  try {
    const res = await fetch('/getUsers');
    adminUsers = await res.json();
  } catch (err) {
    console.error("Failed to load users:", err);
    adminUsers = [];
  }
}

// ➕ Add a new user
async function addNewUser() {
  const username = document.getElementById("newUsername").value.trim();
  const password = document.getElementById("newPassword").value;
  const role = document.getElementById("newRole").value;
  const msg = document.getElementById("userAddMessage");
  const hashPreview = document.getElementById("hashPreview");

  if (!username || !password) {
    msg.textContent = "Please fill out all fields.";
    return;
  }

  const hash = hashPassword(password);
  if (hashPreview) hashPreview.textContent = hash;

  try {
    await fetch('/addUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, hash, role })
    });
    msg.textContent = `✅ User "${username}" added to server.`;

    document.getElementById("newUsername").value = '';
    document.getElementById("newPassword").value = '';
    if (hashPreview) hashPreview.textContent = '[auto]';

  await loadUsers();
  displayUserDropdown();
  populateWordUserDropdown();
  } catch (e) {
    msg.textContent = "❌ Failed to add user.";
    console.error("Add user error:", e);
  }
}

// 🗑 Populate and delete users
function displayUserDropdown() {
  const dropdown = document.getElementById("userDropdown");
  dropdown.innerHTML = `<option value="">-- Select a user --</option>`;
  adminUsers.forEach(user => {
    dropdown.innerHTML += `<option value="${user.username}">${user.username} (${user.role})</option>`;
  });
}

function selectUserAction(username) {
  if (!username) return;

  if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
    document.getElementById("userDropdown").value = "";
    return;
  }

  fetch("/deleteUser", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  })
    .then(res => res.text())
    .then(msg => {
      alert(msg);
      loadUsers().then(displayUserDropdown);
    });
}

// 📚 Save or clear word list for current user
async function saveWords() {
  const selectedUser = document.getElementById('wordUserSelect')?.value;
  if (!selectedUser) {
    alert("⚠️ Please select a user before saving.");
    return;
  }

  const text = document.getElementById('wordInput').value.trim();
  allWords = text.split('\n').map(w => w.trim()).filter(Boolean);

  await fetch('/saveWordList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: selectedUser, words: allWords })
  });

  displayWordList();
  alert(`✅ Word list saved to server for ${selectedUser}`);
}

async function clearWords() {
  const selectedUser = document.getElementById('wordUserSelect')?.value;
  if (!selectedUser) return;

  allWords = [];
  await fetch('/saveWordList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: selectedUser, words: [] })
  });

  displayWordList();
  alert(`🗑 Word list cleared for ${selectedUser}`);
}

// 🗂 Load and display word lists
async function loadWordsForSelectedUser() {
  const selectedUser = document.getElementById("wordUserSelect").value;
  if (!selectedUser) return;

  // Fetch the user's word list object (could be array or {weeks, activeWeek})
  const res = await fetch(`/getWordList?username=${encodeURIComponent(selectedUser)}`);
  const data = await res.json();
  allWords = data.words || [];
  // Now also fetch the raw wordlists object to get weeks/activeWeek
  const wordlistsRes = await fetch('/getWordlistsRaw');
  const wordlists = await wordlistsRes.json();
  const userList = wordlists[selectedUser];
  // If userList is an object with weeks, populate week cards and dropdown
  if (userList && typeof userList === 'object' && Array.isArray(userList.weeks)) {
    // Clear current week cards
    document.getElementById('weeksContainer').innerHTML = '';
    userList.weeks.forEach(week => {
      window.addWeekInput();
      const cards = document.querySelectorAll('#weeksContainer .week-input-card');
      const lastCard = cards[cards.length - 1];
      if (lastCard) {
        lastCard.querySelector('.week-date').value = week.date;
        lastCard.querySelector('.week-words').value = (week.words || []).join('\n');
      }
    });
    // Repopulate the active week dropdown
    window.populateActiveWeekDropdown();
    // Set the dropdown to the saved activeWeek if present
    if (userList.activeWeek) {
      const select = document.getElementById('activeWeekSelect');
      select.value = userList.activeWeek;
    }
  }
  displayWordList();
}

function displayWordList() {
  const ul = document.getElementById('wordListDisplay');
  ul.innerHTML = allWords.map(word => `<li>${word}</li>`).join('');
}

function populateWordUserDropdown() {
  const selects = document.querySelectorAll(".word-user-dropdown");
  selects.forEach(select => {
    select.innerHTML = '<option value="">-- Select a user --</option>';
    adminUsers.forEach(user => {
      const option = document.createElement("option");
      option.value = user.username;
      option.textContent = user.username;
      select.appendChild(option);
    });
  });
}

async function displayWordListForSelectedUser() {
  const select = document.getElementById("viewUserSelect");
  const username = select.value;
  const list = document.getElementById("userWordListDisplay");
  list.innerHTML = '';

  if (!username) return;

  try {
    const res = await fetch(`/getWordList?username=${username}`);
    const data = await res.json();
    const words = data.words || [];
    if (!words.length) {
      list.innerHTML = "<li><em>No words found for this user.</em></li>";
      return;
    }
    words.forEach(word => {
      const li = document.createElement("li");
      li.textContent = word;
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Failed to load word list for user:", username, err);
    list.innerHTML = `<li style="color:red">❌ Error loading words</li>`;
  }
}

// 📊 Student result viewer
window.loadStudentResults = async function() {
  const list = document.getElementById("resultsList");
  list.innerHTML = '';

  try {
    const res = await fetch('/getResults');
    const results = await res.json();

    if (!Object.keys(results).length) {
      list.innerHTML = '<li><em>No results available yet.</em></li>';
      return;
    }

    for (const [username, userResults] of Object.entries(results)) {
      // Handle array of results per user
      if (Array.isArray(userResults) && userResults.length > 0) {
        userResults.forEach((result, index) => {
          const li = document.createElement("li");
          let answersHTML = '';
          
          // Check if result and answers exist and are valid
          if (result && result.answers && Array.isArray(result.answers)) {
            result.answers.forEach(entry => {
              const status = entry.correct ? '✅' : '❌';
              answersHTML += `${status} ${entry.word}<br>`;
            });
          } else {
            answersHTML = '<em>No answer data available</em>';
          }

          const timestamp = result.timestamp ? new Date(result.timestamp).toLocaleString() : 'Unknown time';
          li.innerHTML = `
            <strong>${username}</strong> (Session ${index + 1}) — Score: ${result?.score || 'N/A'}, Completed: ${result?.completed ? '✅' : '❌'}<br>
            <em>Date:</em> ${timestamp}<br>
            <em>Answers:</em><br>${answersHTML}
            <hr style="margin: 1rem 0; opacity: 0.3;">
          `;
          list.appendChild(li);
        });
      } else {
        // Fallback for single result format
        const li = document.createElement("li");
        li.innerHTML = `<strong>${username}</strong> — No valid results found`;
        list.appendChild(li);
      }
    }
  } catch (err) {
    console.error("🔴 Failed to load results:", err);
    list.innerHTML = '<li style="color:red">Error loading results.</li>';
  }
}

async function loadUserDropdowns() {
  try {
    const res = await fetch('/getUsers');
    const users = await res.json();

    const dropdowns = [
      document.getElementById('userDropdown'),
      document.getElementById('wordUserSelect'),
      document.getElementById('viewUserSelect')
    ];

    dropdowns.forEach(drop => {
      if (!drop) return;

      drop.innerHTML = '<option value="">-- Select a user --</option>';
      users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.username;
        opt.textContent = u.username;
        drop.appendChild(opt);
      });
    });
    
    console.log('✅ User dropdowns loaded');
  } catch (err) {
    console.error("⚠️ Failed to load user list:", err);
  }
}
async function refreshAnalytics() {
  const summary = document.getElementById("analyticsSummary");
  const breakdown = document.getElementById("studentBreakdown");
  summary.innerHTML = "<li>Loading...</li>";
  breakdown.innerHTML = "";

  try {
    const res = await fetch('/getResults');
    const data = await res.json();

    let totalScore = 0, sessionCount = 0;
    const missMap = {};

    for (const username in data) {
      const { score, completed, answers } = data[username];
      if (!completed || !Array.isArray(answers)) continue;

      totalScore += score;
      sessionCount++;

      // Count missed words
      answers.forEach(({ word, correct }) => {
        if (!correct) {
          missMap[word] = (missMap[word] || 0) + 1;
        }
      });

      // Per-student breakdown
      const li = document.createElement("li");
      li.innerHTML = `<strong>${username}</strong>: ${score}/${answers.length} correct`;
      breakdown.appendChild(li);
    }

    const avgScore = sessionCount ? (totalScore / sessionCount).toFixed(2) : "0";
    let mostMissed = "-", highestMisses = 0;
    for (const word in missMap) {
      if (missMap[word] > highestMisses) {
        highestMisses = missMap[word];
        mostMissed = word;
      }
    }

    summary.innerHTML = `
      <li><strong>Average Score:</strong> ${avgScore}</li>
      <li><strong>Total Completed Sessions:</strong> ${sessionCount}</li>
      <li><strong>Most Missed Word:</strong> ${mostMissed} (${highestMisses} misses)</li>
    `;
  } catch (err) {
    console.error("📉 Failed to refresh analytics:", err);
    summary.innerHTML = '<li style="color:red">Error loading analytics.</li>';
  }
}
async function loadBadgeViewer() {
  const res = await fetch('/getBadges');
  const badgeData = await res.json();

  const userList = document.getElementById("badgeUserList");
  userList.innerHTML = "";

  for (const username in badgeData) {
    const li = document.createElement("li");
    li.innerHTML = `<button onclick="showUserBadges('${username}')">${username}</button>`;
    userList.appendChild(li);
  }
}

function showUserBadges(username) {
  fetch('/getBadges')
    .then(res => res.json())
    .then(data => {
      const badges = data[username] || [];
      const title = document.getElementById("badgeUserTitle");
      const badgeList = document.getElementById("badgeUserBadges");
      const details = document.getElementById("badgeDetails");

      title.textContent = `Badges for ${username}`;
      badgeList.innerHTML = "";

      if (!badges.length) {
        badgeList.innerHTML = "<li><em>No badges earned yet.</em></li>";
      } else {
        badges.forEach(b => {
          const li = document.createElement("li");
          li.textContent = `🏅 ${b}`;
          badgeList.appendChild(li);
        });
      }

      details.classList.remove("hidden");
    });
}
async function loadStudentNamesForReport() {
  const res = await fetch('/getResults');
  const data = await res.json();
  const select = document.getElementById("reportUser");

  select.innerHTML = `<option value="">-- Select --</option>`;
  Object.keys(data).forEach(username => {
    const opt = document.createElement("option");
    opt.value = username;
    opt.textContent = username;
    select.appendChild(opt);
  });
}

window.loadStudentReport = async function(username) {
  if (!username) return;

  try {
    const res1 = await fetch('/getResults');
    const results = await res1.json();
    const res2 = await fetch('/getBadges');
    const badges = await res2.json();

    const userResults = results[username];
    const badgeList = badges[username] || [];

    // Handle case where userResults might be an array or undefined
    let latestReport = null;
    if (Array.isArray(userResults) && userResults.length > 0) {
      // Get the most recent result
      latestReport = userResults[userResults.length - 1];
    } else if (userResults && typeof userResults === 'object') {
      // Handle single result object
      latestReport = userResults;
    }

    if (!latestReport) {
      document.getElementById("reportContent").classList.add("hidden");
      alert(`No results found for ${username}`);
      return;
    }

    document.getElementById("reportTitle").textContent = `Report for ${username}`;
    
    // Safe access to score and answers
    const score = latestReport.score || 0;
    const answers = latestReport.answers || [];
    document.getElementById("reportScore").textContent = `${score}/${answers.length} correct`;
    
    const wordList = document.getElementById("reportWords");
    wordList.innerHTML = "";
    if (answers.length > 0) {
      answers.forEach(({ word, correct }) => {
        const li = document.createElement("li");
        li.textContent = `${word} — ${correct ? '✅' : '❌'}`;
        wordList.appendChild(li);
      });
    } else {
      wordList.innerHTML = "<li><em>No word data available.</em></li>";
    }

    const badgeContainer = document.getElementById("reportBadges");
    badgeContainer.innerHTML = "";
    if (badgeList.length) {
      badgeList.forEach(b => {
        const li = document.createElement("li");
        li.textContent = `🏅 ${b}`;
        badgeContainer.appendChild(li);
      });
    } else {
      badgeContainer.innerHTML = "<li><em>No badges earned yet.</em></li>";
    }

    document.getElementById("reportContent").classList.remove("hidden");
  } catch (error) {
    console.error("Error loading student report:", error);
    alert("Error loading student report. Please try again.");
  }
}

window.copyReportToClipboard = function() {
  const name = document.getElementById("reportTitle").textContent;
  const score = document.getElementById("reportScore").textContent;
  const words = Array.from(document.querySelectorAll("#reportWords li")).map(li => li.textContent).join("\n");
  const badges = Array.from(document.querySelectorAll("#reportBadges li")).map(li => li.textContent).join("\n");

  const summary = `${name}\nScore: ${score}\n\nWords:\n${words}\n\nBadges:\n${badges}`;
  navigator.clipboard.writeText(summary);
  alert("✅ Report copied to clipboard");
}
async function loadSessionHistory() {
  const res = await fetch('/getResults');
  const allResults = await res.json();

  const list = document.getElementById("sessionSummaryList");
  list.innerHTML = "";

  for (const username in allResults) {
    const sessions = allResults[username];
    const header = document.createElement("li");
    header.innerHTML = `<strong>${username}</strong>`;
    list.appendChild(header);

    sessions.forEach(({ score, answers, timestamp }, index) => {
      const li = document.createElement("li");
      const dateStr = new Date(timestamp).toLocaleString();
      const total = answers.length;
      li.textContent = `🗓️ ${dateStr} — ${score}/${total} correct`;
      list.appendChild(li);
    });
  }
}
async function populateSessionUserDropdown() {
  const res = await fetch('/getResults');
  const allResults = await res.json();
  const select = document.getElementById("sessionUserSelect");

  select.innerHTML = `<option value="">-- Select --</option>`;
  Object.keys(allResults).forEach(username => {
    const opt = document.createElement("option");
    opt.value = username;
    opt.textContent = username;
    select.appendChild(opt);
  });
}

async function loadUserSessions(username) {
  const res = await fetch('/getResults');
  const allResults = await res.json();

  const userSessions = allResults[username] || [];
  const list = document.getElementById("userSessionList");
  list.innerHTML = "";

  userSessions.forEach(({ score, answers, timestamp }) => {
    const sessionItem = document.createElement("li");
    const dateStr = new Date(timestamp).toLocaleString();
    const total = answers.length;

    let html = `<p>🗓️ <strong>${dateStr}</strong> — ${score}/${total} correct</p><ul>`;
    answers.forEach(({ word, correct }) => {
      html += `<li>${correct ? '✅' : '❌'} ${word}</li>`;
    });
    html += "</ul>";

    sessionItem.innerHTML = html;
    list.appendChild(sessionItem);
  });
}

// File upload handler for word lists
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    const words = content.split(/\r?\n/).map(w => w.trim()).filter(Boolean);
    
    document.getElementById('wordInput').value = words.join('\n');
    showToast(`📁 Loaded ${words.length} words from file`);
  };
  reader.readAsText(file);
}

// 🔐 Password Management Functions
window.changeUserPassword = async function() {
  const username = document.getElementById('passwordUsername').value;
  const newPassword = document.getElementById('newUserPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  if (!username) {
    alert('Please select a user');
    return;
  }
  
  if (!newPassword || newPassword.length < 3) {
    alert('Password must be at least 3 characters long');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    alert('Passwords do not match');
    return;
  }
  
  try {
    // Hash the new password (same way as registration)
    const encoder = new TextEncoder();
    const data = encoder.encode(newPassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const newPasswordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Send password change request
    const response = await fetch('/changePassword', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, newPasswordHash })
    });
    
    const message = await response.text();
    
    if (response.ok) {
      alert(message);
      logPasswordChange(username);
      // Clear form
      document.getElementById('newUserPassword').value = '';
      document.getElementById('confirmPassword').value = '';
      document.getElementById('passwordUsername').value = '';
    } else {
      alert('Error: ' + message);
    }
  } catch (error) {
    console.error('Error changing password:', error);
    alert('Failed to change password');
  }
}

// Log password changes
function logPasswordChange(username) {
  const passwordLog = document.getElementById('passwordLog');
  const timestamp = new Date().toLocaleString();
  
  const logEntry = document.createElement('div');
  logEntry.style.padding = '0.5rem';
  logEntry.style.marginBottom = '0.5rem';
  logEntry.style.backgroundColor = 'var(--bg-primary)';
  logEntry.style.borderRadius = 'var(--radius)';
  logEntry.style.borderLeft = '4px solid var(--warning)';
  
  logEntry.innerHTML = `
    <strong>🔐 Password Changed</strong><br>
    <span style="color: var(--text-secondary);">User: ${username}</span><br>
    <span style="color: var(--text-secondary); font-size: 0.9rem;">${timestamp}</span>
  `;
  
  // Remove "no changes" message if it exists
  if (passwordLog.querySelector('p')) {
    passwordLog.innerHTML = '';
  }
  
  // Add new entry at the top
  passwordLog.insertBefore(logEntry, passwordLog.firstChild);
}

// Populate password username dropdown
function populatePasswordUserDropdown() {
  const dropdown = document.getElementById('passwordUsername');
  if (!dropdown || !adminUsers) return;
  
  dropdown.innerHTML = '<option value="">-- Select a user --</option>';
  
  adminUsers.forEach(user => {
    const option = document.createElement('option');
    option.value = user.username;
    option.textContent = `${user.username} (${user.role})`;
    dropdown.appendChild(option);
  });
}

// Add event listeners for admin tabs as backup to onclick
window.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('#adminTabs button');
  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = button.getAttribute('data-tab');
      if (tabId) {
        console.log('Tab clicked:', tabId);
        if (typeof window.switchTab === 'function') {
          window.switchTab(tabId);
        } else {
          console.error('switchTab function not available');
        }
      }
    });
  });
  console.log('✅ Tab event listeners added to', tabButtons.length, 'buttons');
});