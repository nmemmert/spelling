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

// Function to return to student dashboard
window.backToStudentDashboard = function() {
    console.log('🔙 Returning to student dashboard');
    
    // Hide all sections
    document.getElementById('gameSection').classList.add('hidden');
    document.getElementById('gameSection').style.display = 'none';
    document.getElementById('typingSection').classList.add('hidden');
    document.getElementById('typingSection').style.display = 'none';
    
    // Show student panel
    document.getElementById('studentPanel').classList.remove('hidden');
    document.getElementById('studentPanel').style.display = 'block';
    
    // Reset any game/typing state
    document.getElementById('userInput').value = '';
    document.getElementById('typingInput').value = '';
    document.getElementById('wordBox').textContent = '';
    document.getElementById('typingPrompt').textContent = 'Get ready to type...';
    document.getElementById('typingFeedback').textContent = '';
}

// Function to change theme (accessible to students)
window.changeTheme = function(themeName) {
    console.log('🎨 Changing theme to:', themeName);
    
    // Apply the theme
    applyTheme(themeName);
    
    // Save the preference in both possible keys
    localStorage.setItem('selectedTheme', themeName);
    localStorage.setItem('theme', themeName);
    
    // Update both theme selects if they exist
    const adminThemeSelect = document.getElementById('themeSelect');
    const studentThemeSelect = document.getElementById('studentThemeSelect');
    
    if (adminThemeSelect) {
        adminThemeSelect.value = themeName;
    }
    if (studentThemeSelect) {
        studentThemeSelect.value = themeName;
    }
    
    // Show toast notification
    if (typeof showToast === 'function') {
        showToast(`🎨 Theme changed to ${themeName}`);
    }
}