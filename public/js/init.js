/**
 * Enhanced unified initialization script for the Spelling Practice app.
 * This ensures all components are properly loaded and synchronized.
 */

// Make sure this runs after everything else
document.addEventListener('DOMContentLoaded', () => {
  // Run initialization after a small delay to ensure all scripts are loaded
  setTimeout(initializeApp, 500);
});

// Keep track of initialization status
window.appInitialized = false;

// Main initialization function
async function initializeApp() {
  // Prevent duplicate initialization
  if (window.appInitialized) {
    console.log('⏭️ App already initialized, skipping');
    return;
  }

  console.log('🚀 Initializing application...');
  
  // Display initialization status
  const statusElement = document.createElement('div');
  statusElement.id = 'initStatus';
  statusElement.style.cssText = 'position:fixed; bottom:20px; left:20px; background:rgba(0,0,0,0.7); color:white; padding:8px 16px; border-radius:4px; z-index:9999; font-size:14px;';
  statusElement.textContent = 'Initializing app...';
  document.body.appendChild(statusElement);
  
  const updateStatus = (message, isError = false) => {
    if (statusElement) {
      statusElement.textContent = message;
      if (isError) {
        statusElement.style.background = 'rgba(220,53,69,0.9)';
      }
    }
    console.log(message);
  };
  
  // Step 1: Check server connectivity
  try {
    updateStatus('Checking server connection...');
    const serverCheck = await fetch('/getUsers');
    if (serverCheck.ok) {
      updateStatus('Server connection: OK');
    } else {
      updateStatus(`Server error: ${serverCheck.status}: ${serverCheck.statusText}`, true);
      setTimeout(() => statusElement.remove(), 5000);
      return;
    }
  } catch (error) {
    updateStatus(`Cannot connect to server: ${error.message}`, true);
    setTimeout(() => statusElement.remove(), 5000);
    return;
  }
  
  // Step 2: Load user data (if admin)
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.role === 'admin') {
    try {
      updateStatus('Loading user data...');
      
      // Load users using admin.js loadUsers function if available
      if (typeof window.loadUsers === 'function') {
        await window.loadUsers();
      } else {
        // Fallback if loadUsers isn't available
        const response = await fetch('/getUsers');
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        window.adminUsers = await response.json();
      }
      
      updateStatus(`User data loaded: ${window.adminUsers?.length || 0} users`);
    } catch (error) {
      updateStatus(`Failed to load users: ${error.message}`, true);
    }
  }
  
  // Step 3: Sync data between modules
  updateStatus('Synchronizing modules...');
  
  try {
    // If adminUsers exists, make sure it's populated in all dropdowns
    if (window.adminUsers && window.adminUsers.length > 0) {
      // Use displayUserDropdown if it exists
      if (typeof window.displayUserDropdown === 'function') {
        window.displayUserDropdown();
      }
      
      // Also populate analytics dropdown if available
      if (typeof populateUserDropdown === 'function') {
        await populateUserDropdown();
      }
    }
  } catch (error) {
    console.error('Module sync error:', error);
  }
  
  // Step 4: Initialize UI components
  updateStatus('Setting up UI components...');
  
  // Set up tab navigation
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
  
  // Check for chart rendering issues
  if (typeof window.renderAnalyticsDashboard === 'function' && 
      typeof window.safeExec === 'function') {
    window.renderAnalyticsDashboard = window.safeExec(
      window.renderAnalyticsDashboard,
      'Error rendering charts. Please try again.'
    );
  }
  
  // Mark initialization as complete
  window.appInitialized = true;
  updateStatus('Initialization complete ✓');
  
  // Remove status after a few seconds
  setTimeout(() => {
    if (statusElement && statusElement.parentNode) {
      statusElement.remove();
    }
  }, 3000);
}

// Helper function to get current user
function getCurrentUser() {
  const savedUser = localStorage.getItem('loggedInUser');
  return savedUser ? JSON.parse(savedUser) : null;
}
