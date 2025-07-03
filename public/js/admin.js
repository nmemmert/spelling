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
  } catch (e) {
    msg.textContent = "❌ Failed to add user.";
    console.error("Add user error:", e);
  }
}

// 🗑 Populate and delete users
function displayUserDropdown() {
  const dropdown = document.getElementById("userDropdown");
  dropdown.innerHTML = `<option value="">-- Select a user --</option>`;
  users.forEach(user => {
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

  const res = await fetch(`/getWordList?user=${encodeURIComponent(selectedUser)}`);
  allWords = await res.json();
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
    users.forEach(user => {
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
    const res = await fetch(`/getWordList?user=${username}`);
    const words = await res.json();
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
async function loadStudentResults() {
  const list = document.getElementById("resultsList");
  list.innerHTML = '';

  try {
    const res = await fetch('/getResults');
    const results = await res.json();

    if (!Object.keys(results).length) {
      list.innerHTML = '<li><em>No results available yet.</em></li>';
      return;
    }

    for (const [username, result] of Object.entries(results)) {
      const li = document.createElement("li");
      let answersHTML = '';
      result.answers.forEach(entry => {
        const status = entry.correct ? '✅' : '❌';
        answersHTML += `${status} ${entry.word}<br>`;
      });

      li.innerHTML = `
        <strong>${username}</strong> — Score: ${result.score}, Completed: ${result.completed ? '✅' : '❌'}<br>
        <em>Answers:</em><br>${answersHTML}
      `;
      list.appendChild(li);
    }
  } catch (err) {
    console.error("🔴 Failed to load results:", err);
    list.innerHTML = '<li style="color:red">Error loading results.</li>';
  }
}

// 🧭 Admin tab switcher
function switchTab(targetId) {
  document.querySelectorAll('.adminTab').forEach(tab => tab.classList.add('hidden'));
  document.querySelectorAll('#adminTabs button').forEach(btn => btn.classList.remove('active'));

  document.getElementById(targetId).classList.remove('hidden');

  const buttons = document.querySelectorAll('#adminTabs button');
  buttons.forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(targetId)) {
      btn.classList.add('active');
    }
  });

  // 🏆 Load badge viewer if needed
  if (targetId === 'tabBadges') {
    loadBadgeViewer();
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