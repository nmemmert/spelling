// 🎭 Role-Based UI Setup
function setupSession(user) {

  
  // Safe element hiding/showing with null checks
  const loginPanel = document.getElementById('loginPanel');
  const adminPanel = document.getElementById('adminPanel');
  const studentPanel = document.getElementById('studentPanel');
  const nav = document.getElementById('nav');
  

  
  if (loginPanel) loginPanel.classList.add('hidden');
  if (adminPanel) adminPanel.classList.add('hidden');
  if (studentPanel) studentPanel.classList.add('hidden');
  if (nav) nav.classList.remove('hidden');

  // Store current user globally for tablet menu manager
  window.currentUser = user;
  
  const userInfo = document.getElementById('userInfo');
  if (userInfo) {
    userInfo.textContent = `${user.username} (${user.role})`;
  }

  // 🎨 Banner Setup
  const roleBanner = document.getElementById('roleBanner');
  if (roleBanner) {
    roleBanner.classList.remove('hidden', 'admin', 'teacher', 'student');
    roleBanner.classList.add(user.role);
    roleBanner.textContent = user.role === "admin"
      ? "👨‍🏫 Admin Access Enabled"
      : user.role === "teacher"
      ? "👩‍🏫 Teacher Access Enabled"
      : "🎓 Student Mode Active";
  }

  // 🎚 Role-Based Navigation
  const studentBtn = document.getElementById('studentBtn');
  const adminBtn = document.getElementById('adminBtn');

  if (user.role === "admin") {

    if (studentBtn) studentBtn.classList.remove('hidden');
    if (adminBtn) adminBtn.classList.remove('hidden');

    showAdmin();
  } else if (user.role === "teacher") {
    if (studentBtn) studentBtn.classList.remove('hidden');
    if (adminBtn) adminBtn.classList.remove('hidden');
    showAdmin(); // Teachers get admin panel access
  } else if (user.role === "student") {

    if (studentBtn) studentBtn.classList.add('hidden');
    if (adminBtn) adminBtn.classList.add('hidden');

    showStudent();
    
    // Initialize gamification for students
    if (typeof initGamification === 'function') {

      initGamification(user.username);
    }
  } else {
    alert("Unknown role. Logging out for safety.");
    logoutUser();
  }

  // Update enhanced navigation menu
  try {
    if (typeof updateNavigationForUser === 'function') {
      updateNavigationForUser();
    }
  } catch (error) {
    console.warn('Enhanced navigation update failed:', error);
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

  
  // Hide other panels and sections
  document.getElementById('adminPanel')?.classList.add('hidden');
  document.getElementById('loginPanel')?.classList.add('hidden');
  document.getElementById('gameSection')?.classList.add('hidden');
  document.getElementById('typingSection')?.classList.add('hidden');
  document.getElementById('bibleSection')?.classList.add('hidden');
  
  // Also ensure they're hidden with style.display
  const gameSection = document.getElementById('gameSection');
  const typingSection = document.getElementById('typingSection');
  const bibleSection = document.getElementById('bibleSection');
  
  if (gameSection) gameSection.style.display = 'none';
  if (typingSection) typingSection.style.display = 'none';
  if (bibleSection) bibleSection.style.display = 'none';
  
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

    }
    
    // Update student theme selector to match current theme
    const savedTheme = localStorage.getItem('theme') || localStorage.getItem('selectedTheme') || 'default';
    const studentThemeSelect = document.getElementById('studentThemeSelect');
    if (studentThemeSelect) {
      studentThemeSelect.value = savedTheme;
    }
    
    // Initialize dashboard containers with default content
    if (typeof initializeStudentContainers === 'function') {
      setTimeout(() => {
        initializeStudentContainers();
      }, 100);
    }
    
    // Ensure challenge preview is updated
    if (typeof updateDailyChallengePreview === 'function') {
      setTimeout(() => {
        console.log('Calling updateDailyChallengePreview from showStudent');
        updateDailyChallengePreview();
      }, 200);
    }
    
    // Update help bubble visibility
    if (window.tabletMenuManager && typeof window.tabletMenuManager.updateHelpBubbleVisibility === 'function') {
      setTimeout(() => {
        window.tabletMenuManager.updateHelpBubbleVisibility();
      }, 100);
    }
  }
}

function showAdmin() {


  // Hide other panels
  const studentPanel = document.getElementById('studentPanel');
  const loginPanel = document.getElementById('loginPanel');
  
  if (studentPanel) {
    studentPanel.classList.add('hidden');

  }
  if (loginPanel) {
    loginPanel.classList.add('hidden');

  }
  
  const adminPanel = document.getElementById("adminPanel");
  if (adminPanel) {
    adminPanel.classList.remove("hidden");

    
    // Show dashboard view by default
    if (typeof showAdminDashboard === 'function') {
      showAdminDashboard();
    }
    
    // Load users for admin dropdowns
    if (typeof window.loadUsers === 'function') {
      window.loadUsers().catch(err => {
        console.error('Error loading users on admin init:', err);
      });
    }
    
    // Update help bubble visibility for admin
    if (window.tabletMenuManager && typeof window.tabletMenuManager.updateHelpBubbleVisibility === 'function') {
      setTimeout(() => {
        window.tabletMenuManager.updateHelpBubbleVisibility();
      }, 100);
    }
    
    // Load user data for dropdowns (for when tabs are accessed)
    if (typeof window.loadUsers === 'function') {
      window.loadUsers().then(() => {

        if (typeof window.displayUserDropdown === 'function') {
          window.displayUserDropdown();
        }
      }).catch(e => {
        console.warn("Could not load users from server:", e);
      });
    } else {
      console.warn("loadUsers function not available");
    }
    
    // Set default tab to tabWords and enable tab buttons
    document.querySelectorAll('#adminTabs button').forEach(btn => btn.disabled = false);
    if (typeof window.switchTab === 'function') {
      window.switchTab("tabWords");

    } else {
      console.error("switchTab function not available");
    }
  } else {
    console.error("Admin panel not found");
  }
}

// Tab switching functionality
window.switchTab = function(tabId) {

  
  // Hide all tabs
  document.querySelectorAll('.adminTab').forEach(tab => {
    tab.classList.add('hidden');
  });
  
  // Remove active class from all tab buttons
  document.querySelectorAll('#adminTabs button').forEach(button => {
    button.classList.remove('active');
  });
  
  // Show the selected tab
  const selectedTab = document.getElementById(tabId);
  if (selectedTab) {
    selectedTab.classList.remove('hidden');
    
    // Highlight the active tab button
    const activeButton = document.querySelector(`#adminTabs button[data-tab="${tabId}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }
    
    // Special handling for each tab type
    if (tabId === 'tabAnalytics' && typeof window.analyticsRefresh === 'function') {

      window.analyticsRefresh().catch(e => {
        console.error('Error loading analytics:', e);
      });
    } else if (tabId === 'tabResults' && typeof window.loadStudentResults === 'function') {

      window.loadStudentResults().catch(e => {
        console.error('Error loading results:', e);
      });
    }
  } else {
    console.error(`Tab '${tabId}' not found in the DOM`);
  }
};