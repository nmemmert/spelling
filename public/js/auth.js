// 🔐 Password hashing using jsSHA
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

// 🔓 Verify user login
async function verifyLogin() {
  const uname = document.getElementById('username').value.trim();
  const pw = document.getElementById('password').value;
  const msg = document.getElementById('loginMessage');

  if (!uname || !pw) {
    msg.textContent = "Please enter both username and password.";
    msg.style.color = 'var(--error)';
    return;
  }

  try {
    console.log('Attempting login for:', uname);
    const hash = hashPassword(pw);
    console.log('Generated hash:', hash);

    const res = await fetch('/verifyUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uname, hash })
    });

    const responseText = await res.text();
    console.log('Server response:', res.status, responseText);

    if (!res.ok) {
      msg.textContent = "Invalid username or password.";
      msg.style.color = 'var(--error)';
      return;
    }

    const user = JSON.parse(responseText);
    console.log('Login successful for user:', user);
    localStorage.setItem('loggedInUser', JSON.stringify(user));
    msg.textContent = '';
    setupSession(user);
  } catch (err) {
    console.error("Login error:", err);
    msg.textContent = "Login failed. Please try again.";
    msg.style.color = 'var(--error)';
  }
}

// 🚪 Log out user
function logoutUser() {
  localStorage.removeItem('loggedInUser');

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