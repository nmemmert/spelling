// 🔐 Password hashing using jsSHA
function hashPassword(password) {
  const shaObj = new jsSHA("SHA-256", "TEXT");
  shaObj.update(password);
  return shaObj.getHash("HEX");
}

// 🌐 Load users from server
let users = [];

// 🔓 Verify user login
async function verifyLogin() {
  const uname = document.getElementById('username').value.trim();
  const pw = document.getElementById('password').value;
  const hash = hashPassword(pw);
  const msg = document.getElementById('loginMessage');

  try {
    const res = await fetch('/verifyUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uname, hash })
    });

    if (!res.ok) {
      msg.textContent = "Invalid username or password.";
      return;
    }

    const user = await res.json();
    localStorage.setItem('loggedInUser', JSON.stringify(user));
    msg.textContent = '';
    setupSession(user);
  } catch (err) {
    console.error("Login error:", err);
    msg.textContent = "Login failed. Please try again.";
  }
}

// 🚪 Log out user
function logoutUser() {
  localStorage.removeItem('loggedInUser');

  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('studentPanel').classList.add('hidden');
  document.getElementById('nav').classList.add('hidden');
  document.getElementById('loginPanel').classList.remove('hidden');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';

  const roleBanner = document.getElementById('roleBanner');
  roleBanner.classList.add('hidden');
  roleBanner.classList.remove('admin', 'student');
  roleBanner.textContent = '';

  const loginMessage = document.getElementById('loginMessage');
  if (loginMessage) loginMessage.textContent = '';
}