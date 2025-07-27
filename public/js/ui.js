// 🎭 Role-Based UI Setup
function setupSession(user) {
  document.getElementById('loginPanel').classList.add('hidden');
  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('studentPanel').classList.add('hidden');
  document.getElementById('nav').classList.remove('hidden');

  document.getElementById('userInfo').textContent = `${user.username} (${user.role})`;

  // 🎨 Banner Setup
  const roleBanner = document.getElementById('roleBanner');
  roleBanner.classList.remove('hidden', 'admin', 'student');
  roleBanner.classList.add(user.role);
  roleBanner.textContent = user.role === "admin"
    ? "👨‍🏫 Admin Access Enabled"
    : "🎓 Student Mode Active";

  // 🎚 Role-Based Navigation
  const studentBtn = document.getElementById('studentBtn');
  const adminBtn = document.getElementById('adminBtn');

  if (user.role === "admin") {
    studentBtn.classList.remove('hidden');
    adminBtn.classList.remove('hidden');
    showAdmin();
  } else if (user.role === "student") {
    studentBtn.classList.add('hidden');
    adminBtn.classList.add('hidden');
    showStudent();
  } else {
    alert("Unknown role. Logging out for safety.");
    logoutUser();
  }

  showToast(`Welcome, ${user.role}!`);
}

// 🔔 Toast Notification
function showToast(message, duration = 3000) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}
function showStudent() {
  console.log("🎓 Showing student panel");
  
  // Hide other panels
  document.getElementById('adminPanel')?.classList.add('hidden');
  document.getElementById('loginPanel')?.classList.add('hidden');
  
  // Show student panel
  const studentPanel = document.getElementById('studentPanel');
  if (studentPanel) {
    studentPanel.classList.remove('hidden');
    studentPanel.style.display = 'block';
    
    // Ensure buttons are visible and functional
    const gameBtn = document.getElementById('startGameBtn');
    const typingBtn = document.getElementById('startTypingBtn');
    const bibleBtn = document.getElementById('startBibleBtn');
    
    if (gameBtn && typingBtn && bibleBtn) {
      gameBtn.classList.remove('hidden');
      typingBtn.classList.remove('hidden');
      bibleBtn.classList.remove('hidden');
      console.log("✅ All student buttons are now visible");
    }
    
    // Update student theme selector to match current theme
    const savedTheme = localStorage.getItem('theme') || localStorage.getItem('selectedTheme') || 'default';
    const studentThemeSelect = document.getElementById('studentThemeSelect');
    if (studentThemeSelect) {
      studentThemeSelect.value = savedTheme;
    }
  }
}

function showAdmin() {
  console.log("👨‍💼 Showing admin panel");

  // Hide other panels
  document.getElementById('studentPanel')?.classList.add('hidden');
  document.getElementById('loginPanel')?.classList.add('hidden');
  
  const adminPanel = document.getElementById("adminPanel");
  if (adminPanel) {
    adminPanel.classList.remove("hidden");
    
    // Load user data for dropdowns
    loadUserDropdowns().then(() => {
      console.log("✅ User dropdowns loaded");
    }).catch(e => {
      console.warn("Could not load user dropdowns:", e);
    });
    
    // Set default tab to tabWords and enable tab buttons
    setTimeout(() => {
      document.querySelectorAll('#adminTabs button').forEach(btn => btn.disabled = false);
      if (typeof window.switchTab === 'function') {
        window.switchTab("tabWords");
        console.log("✅ Default tab set to tabWords");
      } else {
        console.error("switchTab function not available");
      }
    }, 100);
  } else {
    console.error("Admin panel not found");
  }
}