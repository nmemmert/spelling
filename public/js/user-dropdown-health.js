/**
 * User Dropdown Health Check
 * This script diagnoses and attempts to fix issues with user dropdown population
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('🩺 Running user dropdown health check...');
  
  // Create a debug panel
  const debugPanel = document.createElement('div');
  debugPanel.id = 'userDropdownDebug';
  debugPanel.style.cssText = 'position:fixed; bottom:10px; right:10px; background:#f5f5f5; border:1px solid #ddd; padding:10px; max-width:350px; max-height:400px; overflow:auto; font-size:12px; z-index:9999; display:none';
  debugPanel.innerHTML = `
    <h3 style="margin-top:0">User Dropdown Debug</h3>
    <div id="debugContent"></div>
    <hr>
    <button id="forceUserRefresh" class="btn btn-small">Force Refresh Users</button>
    <button id="hideDebugPanel" class="btn btn-small btn-error">Close</button>
  `;
  document.body.appendChild(debugPanel);
  
  // Add key command to show debug panel (Ctrl+Shift+U)
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'U') {
      debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
      
      if (debugPanel.style.display === 'block') {
        runHealthCheck();
      }
    }
  });
  
  // Add button event listeners
  document.getElementById('hideDebugPanel').addEventListener('click', function() {
    debugPanel.style.display = 'none';
  });
  
  document.getElementById('forceUserRefresh').addEventListener('click', function() {
    forceSyncUserData();
  });
  
  // Run an initial check
  setTimeout(function() {
    validateUserDropdowns(true);
  }, 2000);
  
  // Run health check and output to debug panel
  function runHealthCheck() {
    const debugContent = document.getElementById('debugContent');
    debugContent.innerHTML = '<p>Running diagnostics...</p>';
    
    // Check window.adminUsers
    let report = `<h4>Global User Data</h4>`;
    if (typeof window.adminUsers !== 'undefined') {
      report += `<p>✅ window.adminUsers exists with ${window.adminUsers.length} users</p>`;
      report += `<details><summary>Users list</summary><pre>${JSON.stringify(window.adminUsers.map(u => u.username), null, 2)}</pre></details>`;
    } else {
      report += `<p>❌ window.adminUsers is undefined!</p>`;
    }
    
    // Check all user dropdowns
    report += `<h4>Dropdown Population</h4>`;
    const dropdowns = [
      {id: 'userDropdown', label: 'Main User Dropdown'},
      {id: 'wordUserSelect', label: 'Words Tab User Dropdown'},
      {id: 'passwordUsername', label: 'Password Tab User Dropdown'},
      {id: 'analyticsUserSelect', label: 'Analytics User Dropdown'},
      {id: 'reportUser', label: 'Reports User Dropdown'}
    ];
    
    dropdowns.forEach(dropdown => {
      const element = document.getElementById(dropdown.id);
      if (element) {
        const optionCount = element.options.length;
        const status = optionCount > 1 ? '✅' : '❌';
        report += `<p>${status} ${dropdown.label}: ${optionCount - 1} users</p>`;
      } else {
        report += `<p>❓ ${dropdown.label}: Not found in DOM</p>`;
      }
    });
    
    // Check server connection
    report += `<h4>Server Health</h4>`;
    report += `<p>Testing connection to /getUsers endpoint...</p>`;
    
    fetch('/getUsers')
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error(`Server returned ${response.status}`);
      })
      .then(data => {
        report += `<p>✅ Server returned ${data.length} users</p>`;
        debugContent.innerHTML = report;
      })
      .catch(error => {
        report += `<p>❌ Error fetching users: ${error.message}</p>`;
        debugContent.innerHTML = report;
      });
  }
  
  // Validate all user dropdowns
  function validateUserDropdowns(autoFix = false) {
    console.log('🔍 Validating user dropdowns...');
    
    // Get all user dropdown elements
    const dropdowns = [
      document.getElementById('userDropdown'),
      document.getElementById('wordUserSelect'),
      document.getElementById('passwordUsername'),
      document.getElementById('analyticsUserSelect'),
      document.getElementById('reportUser')
    ].filter(Boolean);
    
    // Check if any dropdown is empty or has only the default option
    const needsRepopulation = dropdowns.some(dropdown => dropdown.options.length <= 1);
    
    if (needsRepopulation && autoFix) {
      console.log('🔧 Found empty dropdowns, attempting to fix...');
      forceSyncUserData();
    }
    
    return !needsRepopulation;
  }
  
  // Force refresh of all user data
  async function forceSyncUserData() {
    console.log('🔄 Forcing synchronization of user data...');
    
    try {
      // Fetch fresh user data from server
      const response = await fetch('/getUsers');
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const users = await response.json();
      
      // Update global user data
      if (typeof window.adminUsers === 'undefined') {
        window.adminUsers = [];
      }
      
      window.adminUsers = users;
      console.log(`✅ Updated global users list with ${users.length} users`);
      
      // Update all dropdowns
      if (typeof window.displayUserDropdown === 'function') {
        window.displayUserDropdown();
      } else {
        console.warn('⚠️ window.displayUserDropdown function not found');
      }
      
      // Also call analytics dropdown population if it exists
      if (typeof populateUserDropdown === 'function') {
        populateUserDropdown();
      }
      
      // Run health check again
      if (document.getElementById('debugContent')) {
        runHealthCheck();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error syncing user data:', error);
      return false;
    }
  }
});
