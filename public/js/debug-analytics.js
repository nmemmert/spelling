// Debug script to test the analytics page
// Save this file to public/js/debug-analytics.js

(function() {
  console.log('🔍 Analytics Debug Helper loaded');

  // Function to check user dropdowns
  function checkUserDropdowns() {
    console.log('Checking user dropdowns...');
    
    const selectors = [
      'analyticsUserSelect',
      'userDropdown',
      'wordUserSelect',
      'passwordUsername',
      'reportUser'
    ];
    
    selectors.forEach(id => {
      const dropdown = document.getElementById(id);
      if (dropdown) {

        console.log(`  - Options: ${dropdown.options.length}`);
        console.log(`  - Values: ${Array.from(dropdown.options).map(o => o.value).join(', ')}`);
      } else {
        console.log(`❌ Dropdown not found: ${id}`);
      }
    });
  }
  
  // Function to manually populate the analytics dropdown
  function populateAnalyticsDropdown() {
    console.log('🔄 Manually populating analytics dropdown...');
    
    const analyticsDropdown = document.getElementById('analyticsUserSelect');
    if (!analyticsDropdown) {
      console.error('❌ Analytics dropdown not found');
      return;
    }
    
    // Clear existing options except the first (All Users)
    while (analyticsDropdown.options.length > 1) {
      analyticsDropdown.remove(1);
    }
    
    // Fetch users directly
    fetch('/getUsers')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        return response.json();
      })
      .then(users => {

        
        // Add users to dropdown
        users.forEach(user => {
          const option = document.createElement('option');
          option.value = user.username;
          option.textContent = user.username;
          analyticsDropdown.appendChild(option);
        });
        

      })
      .catch(error => {
        console.error('❌ Error fetching users:', error);
      });
  }
  
  // Add helper buttons
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      // Create debug control panel
      const debugPanel = document.createElement('div');
      debugPanel.style.position = 'fixed';
      debugPanel.style.bottom = '10px';
      debugPanel.style.right = '10px';
      debugPanel.style.backgroundColor = 'rgba(0,0,0,0.7)';
      debugPanel.style.padding = '10px';
      debugPanel.style.borderRadius = '5px';
      debugPanel.style.color = 'white';
      debugPanel.style.zIndex = '9999';
      debugPanel.style.fontSize = '12px';
      
      // Add title
      const title = document.createElement('div');
      title.textContent = '🐞 Debug Tools';
      title.style.fontWeight = 'bold';
      title.style.marginBottom = '5px';
      debugPanel.appendChild(title);
      
      // Add check dropdowns button
      const checkBtn = document.createElement('button');
      checkBtn.textContent = '👁️ Check Dropdowns';
      checkBtn.style.marginRight = '5px';
      checkBtn.style.padding = '3px 6px';
      checkBtn.addEventListener('click', checkUserDropdowns);
      debugPanel.appendChild(checkBtn);
      
      // Add populate button
      const populateBtn = document.createElement('button');
      populateBtn.textContent = '🔄 Force Populate';
      populateBtn.style.padding = '3px 6px';
      populateBtn.addEventListener('click', populateAnalyticsDropdown);
      debugPanel.appendChild(populateBtn);
      
      document.body.appendChild(debugPanel);
      
      // Initial check after a delay
      setTimeout(checkUserDropdowns, 2000);
    }, 1000);
  });
})();
