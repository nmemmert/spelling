/**
 * Remove debug elements from the page
 */
(function() {
  // Function to remove debug elements
  function removeDebugElements() {
    // List of possible debug element identifiers
    const debugSelectors = [
      'div[id*="debug"]', 
      'div[class*="debug"]',
      'div[style*="zIndex: 9999"]',
      'div:contains("Debug Tools")',
      'button:contains("Check Dropdowns")',
      'button:contains("Force Populate")',
      'button:contains("Debug Input")',
      '[data-debug="true"]'
    ];
    
    // Try to use the selector directly
    debugSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el) el.remove();
        });
      } catch (err) {
        // Just ignore errors in selectors
      }
    });
    
    // Also try to find by content
    document.querySelectorAll('div').forEach(div => {
      if (div.textContent && (
        div.textContent.includes('Debug Tools') || 
        div.textContent.includes('Check Dropdowns') ||
        div.textContent.includes('Force Populate')
      )) {
        div.remove();
      }
    });
  }
  
  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeDebugElements);
  } else {
    removeDebugElements();
  }
  
  // Also run periodically to catch dynamically added elements
  setInterval(removeDebugElements, 1000);
})();
