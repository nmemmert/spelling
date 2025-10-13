/**
 * Debug script for input visibility issues
 */

document.addEventListener('DOMContentLoaded', function() {

  
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
    return;
  }
  
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
  

  
  // Add event listener to log key events (only once)
  if (!userInput.hasKeyLogger) {
    userInput.addEventListener('keydown', function(e) {
      console.log(`Key pressed: ${e.key}`);
    });
    userInput.hasKeyLogger = true;
  }
  

}
