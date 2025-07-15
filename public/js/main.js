document.addEventListener("DOMContentLoaded", async () => {
  console.log('🚀 Application starting...');
  
  // Load users for admin functionality
  try {
    await loadUsers();
    displayUserDropdown();
    populateWordUserDropdown();
  } catch (e) {
    console.warn('Could not load users (normal if not admin):', e);
  }

  // Restore saved theme
  applySavedTheme();

  // Restore session if user was logged in
  const savedUser = localStorage.getItem("loggedInUser");
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      console.log('👤 Restoring session for:', user.username);
      setupSession(user);
    } catch (e) {
      console.error('Error restoring session:', e);
      localStorage.removeItem("loggedInUser");
    }
  } else {
    console.log('👤 No saved session found');
    // Focus on login form
    const usernameField = document.getElementById('username');
    if (usernameField) {
      setTimeout(() => usernameField.focus(), 100);
    }
  }

  // Set default admin tab
  const defaultTab = document.querySelector('#adminTabs button.active');
  if (defaultTab) {
    const targetId = defaultTab.getAttribute("onclick")?.match(/'(.*?)'/)?.[1];
    if (targetId) {
      console.log('🔧 Setting default admin tab:', targetId);
      // Use a small delay to ensure all scripts are loaded
      setTimeout(() => {
        if (typeof window.switchTab === 'function') {
          window.switchTab(targetId);
        } else {
          console.warn('switchTab function not yet available');
        }
      }, 200);
    }
  }
  
  console.log('✅ Application initialized');
});