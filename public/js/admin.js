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
window.showDebugInfo = true; // Enable additional logging
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
// Make adminUsers available globally
window.adminUsers = [];

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
window.loadUsers = async function() {
  try {
    console.log("📋 Loading users from server...");
    const res = await fetch('/getUsers');
    console.log("GET /getUsers response:", res.status, res.statusText);
    
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log(`📋 Loaded ${data.length} users:`, data.map(u => u.username));
    window.adminUsers = data;
    
    // Populate all user dropdowns immediately
    window.displayUserDropdown();
    window.displayUserLists();
    
    return adminUsers;
  } catch (err) {
    console.error("❌ Failed to load users:", err);
    window.adminUsers = [];
    return [];
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

  // Check if hashPassword function exists
  let hash;
  try {
    hash = hashPassword(password);
    console.log("✅ Password hashed successfully");
    if (hashPreview) hashPreview.textContent = hash;
  } catch (e) {
    console.error("❌ Error hashing password:", e);
    msg.textContent = "Error: Unable to hash password. Check console for details.";
    return;
  }

  try {
    console.log(`🔄 Sending request to add user: ${username} (${role})`);
    
    const response = await fetch('/addUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, hash, role })
    });
    
    console.log(`📥 Server response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }
    
    const successText = await response.text();
    console.log(`✅ Success: ${successText}`);
    msg.textContent = `✅ User "${username}" added to server.`;

    // Clear form
    document.getElementById("newUsername").value = '';
    document.getElementById("newPassword").value = '';
    if (hashPreview) hashPreview.textContent = '[auto]';

    // Refresh user lists
    await loadUsers();
    displayUserDropdown();
    if (typeof populateWordUserDropdown === 'function') {
      populateWordUserDropdown();
    }
  } catch (e) {
    msg.textContent = `❌ Failed to add user: ${e.message}`;
    console.error("Add user error:", e);
  }
}

// 🗑 Populate and delete users
window.displayUserDropdown = function() {
  console.log("📋 Populating user dropdowns...");
  
  // Get all user dropdowns in the application
  const userSelectors = [
    "userDropdown",
    "wordUserSelect",
    "passwordUsername",
    "reportUser", 
    "analyticsUserSelect"  // Also update analytics dropdown
  ];
  
  userSelectors.forEach(id => {
    const dropdown = document.getElementById(id);
    if (!dropdown) {
      console.log(`⚠️ Dropdown with ID "${id}" not found`);
      return;
    }
    
    // Save currently selected value if any
    const currentValue = dropdown.value;
    
    // Clear existing options - keep first option if it exists
    const firstOption = dropdown.options.length > 0 ? dropdown.options[0].cloneNode(true) : null;
    dropdown.innerHTML = '';
    if (firstOption && (firstOption.value === '' || firstOption.value === 'all')) {
      dropdown.appendChild(firstOption);
    } else {
      dropdown.innerHTML = `<option value="">-- Select a user --</option>`;
    }
    
    // Add users to dropdown
    if (Array.isArray(window.adminUsers) && window.adminUsers.length > 0) {
      window.adminUsers.forEach(user => {
        const option = document.createElement("option");
        option.value = user.username;
        option.textContent = `${user.username} (${user.role})`;
        dropdown.appendChild(option);
      });
      console.log(`✅ Added ${window.adminUsers.length} users to dropdown ${id}`);
      
      // Restore previously selected value if it exists in the new options
      if (currentValue && [...dropdown.options].some(opt => opt.value === currentValue)) {
        dropdown.value = currentValue;
      }
    } else {
      console.warn(`⚠️ No users to populate in dropdown ${id}`);
    }
  });
}

// Display users in list format
function displayUserLists() {
  console.log("📋 Updating user lists in tables...");
  
  const userTableBody = document.getElementById("userTableBody");
  if (userTableBody) {
    userTableBody.innerHTML = '';
    
    if (Array.isArray(adminUsers) && adminUsers.length > 0) {
      adminUsers.forEach((user, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${user.username}</td>
          <td>${user.role}</td>
          <td>
            <button class="btn-sm btn-danger" onclick="selectUserAction('${user.username}')">🗑️</button>
          </td>
        `;
        userTableBody.appendChild(row);
      });
    } else {
      userTableBody.innerHTML = `<tr><td colspan="4" class="text-center">No users found</td></tr>`;
    }
  }
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
          // Label result type
          let typeLabel = '';
          if (result.type === 'typing') {
            typeLabel = '<span style="color: #007bff; font-weight: bold;">[Typing Practice]</span> ';
          } else {
            typeLabel = '<span style="color: #28a745; font-weight: bold;">[Game]</span> ';
          }
          li.innerHTML = `
            ${typeLabel}<strong>${username}</strong> (Session ${index + 1}) — Score: ${result?.score || 'N/A'}, Completed: ${result?.completed ? '✅' : '❌'}<br>
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

// Analytics functionality has been moved to analytics.js
// This is now just a redirecting function
async function refreshAnalytics() {
  // To avoid circular references, we'll call the function by its name in analytics.js
  console.log("Trying to call analyticsRefresh from window object...");
  if (typeof window.analyticsRefresh === 'function') {
    console.log("Found analyticsRefresh in window, calling it...");
    return window.analyticsRefresh();
  } else {
    console.log("Loading legacy analytics implementation...");
    try {
      const summary = document.getElementById("analyticsSummary");
      const breakdown = document.getElementById("studentBreakdown");
      
      if (summary) summary.innerHTML = "<li>Loading...</li>";
      if (breakdown) breakdown.innerHTML = "";
      
      const res = await fetch('/getResults');
      const data = await res.json();
      
      // Legacy implementation...
      console.log("Analytics data loaded:", Object.keys(data).length, "users");
    } catch (err) {
      console.error("📉 Failed to refresh analytics:", err);
      const summary = document.getElementById("analyticsSummary");
      if (summary) summary.innerHTML = '<li style="color:red">Error loading analytics.</li>';
    }
  }
}

async function loadBadgeViewer() {
  const res = await fetch('/getBadges');
  const badgeData = await res.json();

  const userList = document.getElementById("badgeUserList");
  userList.innerHTML = "";
  
  // Keep track of badge statistics
  let totalBadges = 0;
  let mostBadgesStudent = { name: '-', count: 0 };
  let badgeCounts = {};
  let badgesThisWeek = 0;
  let currentWeekStart = new Date();
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  
  // Process badge data
  for (const username in badgeData) {
    // Create student list items
    const li = document.createElement("li");
    li.innerHTML = `<button onclick="showUserBadges('${username}')">${username}</button>`;
    userList.appendChild(li);
    
    // Calculate badge statistics
    let userBadgeCount = 0;
    
    if (Array.isArray(badgeData[username])) {
      // Old format
      userBadgeCount = badgeData[username].length;
      
      // Track badge types
      badgeData[username].forEach(badge => {
        if (!badgeCounts[badge]) badgeCounts[badge] = 0;
        badgeCounts[badge]++;
      });
      
    } else if (badgeData[username] && badgeData[username].earned) {
      // New format
      userBadgeCount = badgeData[username].earned.length;
      
      // Track badge types
      badgeData[username].earned.forEach(badge => {
        // Count total badges
        totalBadges++;
        
        // Count by badge name
        const badgeName = badge.name;
        if (!badgeCounts[badgeName]) badgeCounts[badgeName] = 0;
        badgeCounts[badgeName]++;
        
        // Count recent badges
        if (badge.earnedAt) {
          const earnedDate = new Date(badge.earnedAt);
          if (earnedDate > currentWeekStart) {
            badgesThisWeek++;
          }
        }
      });
    }
    
    // Track user with most badges
    if (userBadgeCount > mostBadgesStudent.count) {
      mostBadgesStudent = { name: username, count: userBadgeCount };
    }
  }
  
  // Find most common badge
  let mostCommonBadge = { name: '-', count: 0 };
  for (const badge in badgeCounts) {
    if (badgeCounts[badge] > mostCommonBadge.count) {
      mostCommonBadge = { name: badge, count: badgeCounts[badge] };
    }
  }
  
  // Update badge statistics display
  document.getElementById('totalBadgesAwarded').textContent = totalBadges;
  document.getElementById('mostBadgesStudent').textContent = mostBadgesStudent.name !== '-' ? 
    `${mostBadgesStudent.name} (${mostBadgesStudent.count})` : '-';
  document.getElementById('mostCommonBadge').textContent = mostCommonBadge.name !== '-' ?
    `${mostCommonBadge.name} (${mostCommonBadge.count})` : '-';
  document.getElementById('badgesThisWeek').textContent = badgesThisWeek;
  
  // Add search functionality
  const searchInput = document.getElementById('badgeStudentSearch');
  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    document.querySelectorAll('#badgeUserList li').forEach(li => {
      const username = li.textContent.toLowerCase();
      if (username.includes(searchTerm)) {
        li.style.display = '';
      } else {
        li.style.display = 'none';
      }
    });
  });
  
  // Add filter functionality
  document.querySelectorAll('.badge-filters button').forEach(button => {
    button.addEventListener('click', function() {
      // Update active state
      document.querySelectorAll('.badge-filters button').forEach(btn => {
        btn.classList.remove('active');
      });
      this.classList.add('active');
      
      // Apply filter
      const filter = this.getAttribute('data-filter');
      const badgeCards = document.querySelectorAll('.admin-badge-card');
      
      badgeCards.forEach(card => {
        if (filter === 'all' || card.getAttribute('data-category') === filter) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
  
  // Initialize print certificates functionality
  document.getElementById('printBadges').addEventListener('click', function() {
    const username = document.getElementById('badgeUserTitle').textContent.replace('Badges for ', '');
    printBadgeCertificate(username);
  });
  
  // Initialize custom badge award functionality
  document.getElementById('awardCustomBadge').addEventListener('click', function() {
    const username = document.getElementById('badgeUserTitle').textContent.replace('Badges for ', '');
    showCustomBadgeModal(username);
  });
}

function showUserBadges(username) {
  fetch('/getBadges')
    .then(res => res.json())
    .then(data => {
      const userBadgeData = data[username];
      const title = document.getElementById("badgeUserTitle");
      const badgeList = document.getElementById("badgeUserBadges");
      const details = document.getElementById("badgeDetails");
      let badges = [];
      
      // Handle different badge data formats
      if (!userBadgeData) {
        badges = [];
      } else if (Array.isArray(userBadgeData)) {
        // Old format
        badges = userBadgeData.map(name => ({ 
          name, 
          icon: "🏅", 
          color: "#4a5568" 
        }));
      } else if (userBadgeData.earned) {
        // New format
        badges = userBadgeData.earned;
      }

      title.textContent = `Badges for ${username}`;
      badgeList.innerHTML = "";
      
      // Create badge stats summary
      const badgeStats = document.createElement("div");
      badgeStats.className = "badge-stats";
      
      // Calculate badge counts by category
      const categoryStats = {};
      if (userBadgeData && userBadgeData.counts) {
        Object.entries(userBadgeData.counts).forEach(([category, count]) => {
          categoryStats[category] = count;
        });
      } else {
        // Calculate from badges array
        badges.forEach(badge => {
          const category = badge.category || 'other';
          if (!categoryStats[category]) categoryStats[category] = 0;
          categoryStats[category]++;
        });
      }
      
      // Create badge summary
      badgeStats.innerHTML = `
        <div class="badge-summary">
          <h3>Badge Summary</h3>
          <div class="badge-total">
            <span class="badge-count">${badges.length}</span>
            <span class="badge-label">Total Badges</span>
          </div>
          <div class="badge-categories">
            ${Object.entries(categoryStats).map(([category, count]) => `
              <div class="badge-category">
                <span class="category-name">${category.charAt(0).toUpperCase() + category.slice(1)}</span>
                <span class="category-count">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      
      badgeList.appendChild(badgeStats);

      if (!badges.length) {
        const emptyState = document.createElement("div");
        emptyState.className = "empty-badges";
        emptyState.innerHTML = `
          <div class="empty-badge-icon">🏆</div>
          <h3>No badges earned yet</h3>
          <p>Complete spelling activities to earn badges!</p>
        `;
        badgeList.appendChild(emptyState);
      } else {
        // Create badge grid for displaying badges
        const badgeGrid = document.createElement("div");
        badgeGrid.className = "badge-grid";
        
        badges.forEach(badge => {
          const badgeCard = document.createElement("div");
          badgeCard.className = "admin-badge-card";
          
          const badgeIcon = badge.icon || "🏅";
          const badgeColor = badge.color || "#4a5568";
          const badgeName = badge.name;
          const badgeDesc = badge.description || "";
          const badgeDate = badge.earnedAt ? new Date(badge.earnedAt).toLocaleDateString() : "";
          
          badgeCard.style.borderColor = badgeColor;
          
          badgeCard.innerHTML = `
            <div class="admin-badge-icon" style="background-color: ${badgeColor}40">
              <span>${badgeIcon}</span>
            </div>
            <div class="admin-badge-info">
              <h4>${badgeName}</h4>
              ${badgeDesc ? `<p class="admin-badge-desc">${badgeDesc}</p>` : ''}
              ${badgeDate ? `<div class="admin-badge-date">Earned: ${badgeDate}</div>` : ''}
            </div>
          `;
          
          badgeGrid.appendChild(badgeCard);
        });
        
        badgeList.appendChild(badgeGrid);
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
    let allUserResults = [];
    if (Array.isArray(userResults) && userResults.length > 0) {
      // Get the most recent result
      latestReport = userResults[userResults.length - 1];
      allUserResults = userResults;
    } else if (userResults && typeof userResults === 'object') {
      // Handle single result object
      latestReport = userResults;
      allUserResults = [userResults];
    }

    if (!latestReport) {
      document.getElementById("reportContent").classList.add("hidden");
      alert(`No results found for ${username}`);
      return;
    }

    document.getElementById("reportTitle").textContent = `Report for ${username}`;
    
    // Safe access to score and answers, handling different data formats
    const score = latestReport.score || latestReport.correct || 0;
    
    // Handle both answers array and words array formats
    let answers = [];
    if (latestReport.answers && Array.isArray(latestReport.answers)) {
      answers = latestReport.answers;
    } else if (latestReport.words && Array.isArray(latestReport.words)) {
      answers = latestReport.words;
    }
    
    const total = answers.length || latestReport.total || 0;
    document.getElementById("reportScore").textContent = `${score}/${total} correct`;
    
    const wordList = document.getElementById("reportWords");
    wordList.innerHTML = "";
    if (answers.length > 0) {
      answers.forEach((answer) => {
        const word = answer.word || '';
        const correct = answer.correct || false;
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

    // Generate progress chart if function exists
    if (typeof window.createScoreChart === 'function') {
      createScoreChart(username, allUserResults);
    }

    // Generate word difficulty chart if function exists
    if (typeof window.createWordDifficultyChart === 'function') {
      createWordDifficultyChart(username, allUserResults);
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
  // Delegate to the window.loadUserSessions function in sessions.js
  // This ensures we have consistent behavior
  if (typeof window.loadUserSessions === 'function') {
    window.loadUserSessions(username);
  } else {
    console.error("Error: window.loadUserSessions function not found");
    
    // Fallback implementation
    const res = await fetch('/getResults');
    const allResults = await res.json();

    const userSessions = allResults[username] || [];
    const list = document.getElementById("userSessionList");
    list.innerHTML = "";
    
    if (userSessions.length === 0) {
      list.innerHTML = '<li style="padding: 1rem; text-align: center;">No sessions found.</li>';
      return;
    }

    userSessions.forEach((session) => {
      const sessionItem = document.createElement("li");
      
      // Support both timestamp and date fields
      const sessionDate = session.timestamp || session.date || Date.now();
      const dateStr = new Date(sessionDate).toLocaleString();
      
      // Handle various score formats
      const score = session.score || session.correct || 0;
      
      // Handle different answer formats
      let answersArray = [];
      let total = 0;
      
      if (session.answers && Array.isArray(session.answers)) {
        answersArray = session.answers;
        total = answersArray.length;
      } else if (session.words && Array.isArray(session.words)) {
        answersArray = session.words;
        total = answersArray.length;
      } else if (session.total) {
        total = session.total;
      }

      let html = `<p>🗓️ <strong>${dateStr}</strong> — ${score}/${total} correct</p><ul>`;
      
      answersArray.forEach((answer) => {
        const word = answer.word || '';
        const correct = answer.correct || false;
        html += `<li>${correct ? '✅' : '❌'} ${word}</li>`;
      });
      
      html += "</ul>";

      sessionItem.innerHTML = html;
      list.appendChild(sessionItem);
    });
  }
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