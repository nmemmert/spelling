// Add this script in the head element of index.html for temporary debugging
(() => {
  // Store the original fetch method to monitor all network requests
  const originalFetch = window.fetch;
  
  // Override fetch to log all requests and responses
  window.fetch = async function(url, options) {
    console.log(`🔍 DEBUG: Fetch request to ${url}`, options);
    
    try {
      const response = await originalFetch(url, options);
      
      // Clone the response to leave the original intact
      const clone = response.clone();
      
      // Log the response
      console.log(`🔍 DEBUG: Fetch response from ${url}`, {
        status: clone.status,
        statusText: clone.statusText,
        headers: Object.fromEntries([...clone.headers.entries()])
      });
      
      // If it's a JSON response, log the data
      if (clone.headers.get('content-type')?.includes('application/json')) {
        try {
          const data = await clone.json();
          console.log(`🔍 DEBUG: JSON response from ${url}`, data);
        } catch (e) {
          console.error(`🔍 DEBUG: Error parsing JSON from ${url}`, e);
        }
      }
      
      return response;
    } catch (error) {
      console.error(`🔍 DEBUG: Fetch error for ${url}`, error);
      throw error;
    }
  };
  
  // Monitor all select elements for changes
  const observeSelects = () => {
    const selects = document.querySelectorAll('select');
    console.log(`🔍 DEBUG: Found ${selects.length} select elements`);
    
    selects.forEach((select, index) => {
      console.log(`🔍 DEBUG: Select #${index}:`, {
        id: select.id,
        name: select.name,
        optionCount: select.options.length,
        options: Array.from(select.options).map(opt => ({ 
          value: opt.value, 
          text: opt.text,
          disabled: opt.disabled
        }))
      });
      
      // Watch for changes in the options
      const observer = new MutationObserver(mutations => {
        console.log(`🔍 DEBUG: Select #${index} (${select.id}) changed:`, {
          optionCount: select.options.length,
          options: Array.from(select.options).map(opt => ({
            value: opt.value, 
            text: opt.text,
            disabled: opt.disabled
          }))
        });
      });
      
      observer.observe(select, { childList: true });
    });
  };
  
  // Run once DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🔍 DEBUG: DOM loaded, monitoring select elements');
    setTimeout(observeSelects, 1000);
    
    // Add click handler for analytics tab
    const analyticsTab = document.querySelector('button[data-tab="tabAnalytics"]');
    if (analyticsTab) {
      const originalClick = analyticsTab.onclick;
      
      analyticsTab.addEventListener('click', () => {
        console.log('🔍 DEBUG: Analytics tab clicked');
        setTimeout(() => {
          const userSelect = document.getElementById('analyticsUserSelect');
          if (userSelect) {
            console.log('🔍 DEBUG: Analytics user select status:', {
              optionCount: userSelect.options.length,
              options: Array.from(userSelect.options).map(opt => ({
                value: opt.value, 
                text: opt.text 
              }))
            });
          } else {
            console.log('🔍 DEBUG: Analytics user select not found');
          }
        }, 500);
      });
    }
  });
})();
