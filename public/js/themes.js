// 🎨 Apply saved theme on load
function applySavedTheme() {
  const savedTheme = localStorage.getItem('theme') || 'playground';
  document.body.className = savedTheme;

  const themeSelector = document.getElementById('themeSelect');
  if (themeSelector) themeSelector.value = savedTheme;
}

// 🎨 Change theme dynamically
function changeTheme(themeName) {
  document.body.className = themeName;
  localStorage.setItem('theme', themeName);
}