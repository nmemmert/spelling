/**
 * Debug script for input visibility issues
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('🔍 Input visibility fix script loaded');
  
  // No debug button in production
  // Just silently apply fixes
  
  // Setup input monitoring
  const userInput = document.getElementById('userInput');
  if (userInput) {
    userInput.addEventListener('input', function(e) {
      console.log('📝 Input value:', e.target.value);
    });
  }
  
  // Apply the fix once at startup
  setTimeout(fixInputVisibility, 1000);
});

// Function to fix input visibility - simplified to avoid loops
function fixInputVisibility() {
  const userInput = document.getElementById('userInput');
  if (!userInput) {
    console.log('❌ User input element not found');
    return;
  }
  
  console.log('🔧 Fixing input visibility');
  
  // Create a style element for stronger CSS
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    #userInput {
      color: black !important;
      background-color: white !important;
      border: 2px solid #333 !important;
      font-size: 18px !important;
      padding: 12px !important;
      visibility: visible !important;
      opacity: 1 !important;
      text-shadow: none !important;
      -webkit-text-fill-color: black !important;
      display: inline-block !important;
    }
  `;
  document.head.appendChild(styleEl);
  
  // Create a test notification
  const notification = document.createElement('div');
  notification.textContent = 'Input visibility fixed';
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.backgroundColor = '#4CAF50';
  notification.style.color = 'white';
  notification.style.padding = '10px 20px';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '10000';
  
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.remove();
  }, 3000);
  
  // Add event listener to log key events (only once)
  if (!userInput.hasKeyLogger) {
    userInput.addEventListener('keydown', function(e) {
      console.log(`Key pressed: ${e.key}`);
    });
    userInput.hasKeyLogger = true;
  }
  
  console.log('✅ Input visibility fix applied');
}
