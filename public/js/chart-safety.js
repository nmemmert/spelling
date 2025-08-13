/**
 * Enhanced error handling for charts in analytics.js
 * This will wrap critical chart functions with try/catch blocks
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  // Add a global error handler for SVG operations
  window.addEventListener('error', function(event) {
    // Check if error is related to SVG path
    if (event.message && (event.message.includes('attribute d') || 
        event.message.includes('SVG') || 
        event.message.includes('path'))) {
      console.error('SVG Error intercepted:', event.message);
      event.preventDefault(); // Prevent the error from appearing in console
      
      // Try to find the affected chart container
      const containers = [
        'progressChartContainer',
        'activityHeatmap',
        'problemWordsList',
        'userComparisonChart'
      ];
      
      containers.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
          // Add error message to container
          const errorMsg = document.createElement('div');
          errorMsg.className = 'chart-error';
          errorMsg.textContent = 'Error rendering chart. Try refreshing.';
          errorMsg.style.color = 'var(--error)';
          errorMsg.style.padding = '1rem';
          errorMsg.style.textAlign = 'center';
          
          // Clear container and show error
          container.innerHTML = '';
          container.appendChild(errorMsg);
        }
      });
      
      return true;
    }
    return false;
  });
  
  // Try to monkey patch the chart rendering functions if they exist
  const safeExec = function(fn, fallbackMsg) {
    return function(...args) {
      try {
        return fn.apply(this, args);
      } catch (error) {
        console.error(`Chart rendering error: ${error.message}`, error);
        
        // Display fallback message if container is provided
        if (args[1] && typeof args[1] === 'string') {
          const container = document.getElementById(args[1]);
          if (container) {
            container.innerHTML = `<div class="chart-error">${fallbackMsg || 'Error rendering chart'}</div>`;
          }
        }
        return null;
      }
    };
  };
  
  // Add the safety wrapper to existing functions once analytics.js is loaded
  if (window.analyticsRefresh) {
    console.log('📊 Adding safety wrappers to chart functions');
    
    // Wait a bit to ensure all analytics functions are loaded
    setTimeout(() => {
      // Store references to original functions
      const originalRenderDashboard = window.renderAnalyticsDashboard;
      
      if (originalRenderDashboard) {
        window.renderAnalyticsDashboard = safeExec(originalRenderDashboard, 
          'Unable to render analytics dashboard. Please try refreshing the page.');
        console.log('✅ Added safety wrapper to renderAnalyticsDashboard');
      }
    }, 1000);
  }
});
