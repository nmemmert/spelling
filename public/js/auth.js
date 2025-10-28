// Password hashing using jsSHA
function hashPassword(password) {
  try {
    if (typeof jsSHA === 'undefined') {
      console.error('jsSHA library not loaded');
      throw new Error('jsSHA library not available');
    }
    const shaObj = new jsSHA("SHA-256", "TEXT");
    shaObj.update(password);
    return shaObj.getHash("HEX");
  } catch (error) {
    console.error('Error hashing password:', error);
    // Fallback: simple hash (not secure, but for debugging)
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

// 🌐 Load users from server
let users = [];

// Debug function for browser console testing
window.debugAuth = function() {

  console.log('- localStorage user:', localStorage.getItem('loggedInUser'));
  console.log('- Login panel element:', !!document.getElementById('loginPanel'));
  console.log('- Admin panel element:', !!document.getElementById('adminPanel'));
  console.log('- Student panel element:', !!document.getElementById('studentPanel'));
};

// 🧪 Test login function for debugging
window.testLogin = function() {
  console.log('🧪 Testing manual login...');
  document.getElementById('username').value = 'admin';
  document.getElementById('password').value = 'admin';
  verifyLogin();
};

// 🔓 Verify user login
async function verifyLogin() {
  console.log('🚀 verifyLogin function called');
  
  const uname = document.getElementById('username').value.trim();
  const pw = document.getElementById('password').value;
  const msg = document.getElementById('loginMessage');

  console.log('📋 Form values:', { username: uname, passwordLength: pw?.length || 0 });

  if (!uname || !pw) {
    console.log('❌ Missing username or password');
    msg.textContent = "Please enter both username and password.";
    msg.style.color = 'var(--error)';
    return;
  }

  try {


    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uname, password: pw })
    });

    const responseText = await res.text();
    console.log('📡 Server response:', res.status, responseText);

    if (!res.ok) {
      console.log('❌ Login failed - server returned error');
      msg.textContent = "Invalid username or password.";
      msg.style.color = 'var(--error)';
      return;
    }

    const loginData = JSON.parse(responseText);

    
    // Store both user data and JWT token
    localStorage.setItem('loggedInUser', JSON.stringify(loginData.user));
    localStorage.setItem('authToken', loginData.token);
    msg.textContent = '';
    
    console.log('🚀 About to call setupSession with:', loginData.user);
    setupSession(loginData.user);

  } catch (err) {
    console.error("Login error:", err);
    msg.textContent = "Login failed. Please try again.";
    msg.style.color = 'var(--error)';
  }
}

// 🚪 Log out user
function logoutUser() {
  localStorage.removeItem('loggedInUser');

  // Clear current user
  window.currentUser = null;

  // Close tablet menu if open
  if (window.tabletMenuManager && window.tabletMenuManager.isMenuOpen()) {
    window.tabletMenuManager.forceCloseMenu();
  }

  // Hide all panels
  document.getElementById('adminPanel')?.classList.add('hidden');
  document.getElementById('studentPanel')?.classList.add('hidden');
  document.getElementById('nav')?.classList.add('hidden');
  
  // Show login panel
  const loginPanel = document.getElementById('loginPanel');
  loginPanel?.classList.remove('hidden');
  
  // Clear login form
  const usernameField = document.getElementById('username');
  const passwordField = document.getElementById('password');
  const loginMessage = document.getElementById('loginMessage');
  
  if (usernameField) usernameField.value = '';
  if (passwordField) passwordField.value = '';
  if (loginMessage) {
    loginMessage.textContent = '';
    loginMessage.style.color = '';
  }

  // Reset banner
  const roleBanner = document.getElementById('roleBanner');
  if (roleBanner) {
    roleBanner.classList.add('hidden');
    roleBanner.classList.remove('admin', 'student');
    roleBanner.textContent = '';
  }

  // Focus on username field
  if (usernameField) {
    setTimeout(() => usernameField.focus(), 100);
  }
  
  showToast('Logged out successfully');
}

// Add Enter key support for login form
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('#loginPanel form');
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    
    if (loginForm && usernameField && passwordField) {
        // Focus username field on page load
        usernameField.focus();
        
        // Add Enter key support
        [usernameField, passwordField].forEach(field => {
            field.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    verifyLogin();
                }
            });
        });
    }
});

// 🔐 Utility function for authenticated API requests
window.authenticatedFetch = function(url, options = {}) {
  const token = localStorage.getItem('authToken');
  if (!token) {
    // If no token, redirect to login or throw error
    console.warn('No auth token found, redirecting to login');
    showLoginPanel();
    throw new Error('Authentication required');
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  return fetch(url, {
    ...options,
    headers
  });
};