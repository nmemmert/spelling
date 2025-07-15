document.addEventListener("DOMContentLoaded", async () => {
  console.log('🚀 Application starting...');
  
  // Ensure all panels are hidden initially
  document.getElementById('adminPanel')?.classList.add('hidden');
  document.getElementById('studentPanel')?.classList.add('hidden');
  document.getElementById('gameSection')?.classList.add('hidden');
  document.getElementById('typingSection')?.classList.add('hidden');
  document.getElementById('bibleSection')?.classList.add('hidden');
  document.getElementById('nav')?.classList.add('hidden');
  document.getElementById('roleBanner')?.classList.add('hidden');

  // Restore saved theme
  applySavedTheme();

  // Restore session if user was logged in
  const savedUser = localStorage.getItem("loggedInUser");
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      console.log('👤 Restoring session for:', user.username);
      
      // Load users for admin functionality only if user is admin
      if (user.role === 'admin') {
        try {
          await loadUsers();
          displayUserDropdown();
          populateWordUserDropdown();
        } catch (e) {
          console.warn('Could not load admin data:', e);
        }
      }
      
      setupSession(user);
    } catch (e) {
      console.error('Error restoring session:', e);
      localStorage.removeItem("loggedInUser");
      showLoginOnly();
    }
  } else {
    console.log('👤 No saved session found');
    showLoginOnly();
  }
});

// Function to show only the login panel
function showLoginOnly() {
  // Hide all panels
  document.getElementById('adminPanel')?.classList.add('hidden');
  document.getElementById('studentPanel')?.classList.add('hidden');
  document.getElementById('gameSection')?.classList.add('hidden');
  document.getElementById('typingSection')?.classList.add('hidden');
  document.getElementById('bibleSection')?.classList.add('hidden');
  document.getElementById('nav')?.classList.add('hidden');
  document.getElementById('roleBanner')?.classList.add('hidden');
  
  // Show login panel
  document.getElementById('loginPanel')?.classList.remove('hidden');
  
  // Focus on login form
  const usernameField = document.getElementById('username');
  if (usernameField) {
    setTimeout(() => usernameField.focus(), 100);
  }
}

// Function to return to student dashboard
window.backToStudentDashboard = function() {
    console.log('🔙 Returning to student dashboard');
    
    // Hide all sections
    document.getElementById('gameSection').classList.add('hidden');
    document.getElementById('gameSection').style.display = 'none';
    document.getElementById('typingSection').classList.add('hidden');
    document.getElementById('typingSection').style.display = 'none';
    document.getElementById('bibleSection').classList.add('hidden');
    document.getElementById('bibleSection').style.display = 'none';
    
    // Show student panel
    document.getElementById('studentPanel').classList.remove('hidden');
    document.getElementById('studentPanel').style.display = 'block';
    
    // Reset any game/typing state
    const userInput = document.getElementById('userInput');
    const typingInput = document.getElementById('typingInput');
    const wordBox = document.getElementById('wordBox');
    const typingPrompt = document.getElementById('typingPrompt');
    const typingFeedback = document.getElementById('typingFeedback');
    
    if (userInput) userInput.value = '';
    if (typingInput) typingInput.value = '';
    if (wordBox) wordBox.textContent = '';
    if (typingPrompt) typingPrompt.textContent = 'Get ready to type...';
    if (typingFeedback) typingFeedback.textContent = '';
    
    // Reset Bible typing state
    if (typeof window.resetBibleInterface === 'function') {
        window.resetBibleInterface();
    }
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