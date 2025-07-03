document.addEventListener("DOMContentLoaded", async () => {
  // 🌐 Load users.json for login validation
  // await loadUsers();
  displayUserDropdown();
  populateWordUserDropdown();

  // 🎨 Restore saved theme
  applySavedTheme();

  // 🔁 Restore session if user was logged in
  const savedUser = localStorage.getItem("loggedInUser");
  if (savedUser) {
    setupSession(JSON.parse(savedUser));
  }

  // 🧭 Tab switching for Admin Panel
  const defaultTab = document.querySelector('#adminTabs button.active');
  if (defaultTab) {
    const targetId = defaultTab.getAttribute("onclick")?.match(/'(.*?)'/)?.[1];
    if (targetId) switchTab(targetId);
  }
});