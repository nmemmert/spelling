document.addEventListener("DOMContentLoaded", async () => {

  
  // Check if server is available
  try {

    const serverTest = await fetch('/health');
    if (serverTest.ok) {

    } else {
      console.error(`❌ Server responded with error: ${serverTest.status}`);
    }
  } catch (e) {
    console.error('❌ Server connection failed:', e.message);
  }
  
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

  // Global error handler for fetch operations
  window.handleApiError = function(error, operation) {
    console.error(`❌ API Error during ${operation}:`, error);
    alert(`Network error during ${operation}. Please check your connection and try again.`);
  };

  // Restore session if user was logged in
  const savedUser = localStorage.getItem("loggedInUser");
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);

      
      // Load users for admin functionality only if user is admin or teacher
      if (user.role === 'admin' || user.role === 'teacher') {
        try {

          await loadUsers();
          displayUserDropdown();
          displayUserLists();
          
          // Initialize all user dropdowns
          if (typeof populateWordUserDropdown === 'function') {
            populateWordUserDropdown();
          }
          if (typeof window.populateUserDropdown === 'function') {
            window.populateUserDropdown();
          }
        } catch (e) {
          console.warn('⚠️ Could not load admin data:', e);
        }
      }
      
      setupSession(user);
    } catch (e) {
      console.error('Error restoring session:', e);
      localStorage.removeItem("loggedInUser");
      showLoginOnly();
    }
  } else {

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

// Theme change function is now in themes.js