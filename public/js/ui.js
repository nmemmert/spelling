// 🎭 Role-Based UI Setup
function setupSession(user) {
  document.getElementById('loginPanel').classList.add('hidden');
  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('studentPanel').classList.add('hidden');
  document.getElementById('nav').classList.remove('hidden');

  document.getElementById('userInfo').textContent = `${user.username} (${user.role})`;

  // 🎨 Banner Setup
  const roleBanner = document.getElementById('roleBanner');
  roleBanner.classList.remove('hidden', 'admin', 'student');
  roleBanner.classList.add(user.role);
  roleBanner.textContent = user.role === "admin"
    ? "👨‍🏫 Admin Access Enabled"
    : "🎓 Student Mode Active";

  // 🎚 Role-Based Navigation
  const studentBtn = document.getElementById('studentBtn');
  const adminBtn = document.getElementById('adminBtn');

  if (user.role === "admin") {
    studentBtn.classList.remove('hidden');
    adminBtn.classList.remove('hidden');
    showAdmin();
  } else if (user.role === "student") {
    studentBtn.classList.add('hidden');
    adminBtn.classList.add('hidden');
    showStudent();
  } else {
    alert("Unknown role. Logging out for safety.");
    logoutUser();
  }

  showToast(`Welcome, ${user.role}!`);
}

// 🔔 Toast Notification
function showToast(message, duration = 3000) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}
function showAdmin() {
  console.log("showAdmin fired");

  const adminPanel = document.getElementById("adminPanel");
  const studentPanel = document.getElementById("studentPanel");
  
  loadUserDropdowns();

  adminPanel?.classList.remove("hidden");
  studentPanel?.classList.add("hidden");

  switchTab("tabUsers"); // optional default tab
}