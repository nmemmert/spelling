// Modern theme system
function applySavedTheme() {
  const savedTheme = localStorage.getItem('theme') || 'default';
  applyTheme(savedTheme);

  const themeSelector = document.getElementById('themeSelect');
  if (themeSelector) themeSelector.value = savedTheme;
}

function changeTheme(themeName) {
  applyTheme(themeName);
  localStorage.setItem('theme', themeName);
  showToast(`🎨 Theme changed to ${themeName}`);
}

function applyTheme(themeName) {
  // Remove existing theme classes
  document.body.className = '';
  
  // Apply theme-specific styles
  switch(themeName) {
    case 'playground':
      document.body.className = 'theme-playground';
      document.documentElement.style.setProperty('--primary', '#ff6b6b');
      document.documentElement.style.setProperty('--accent', '#4ecdc4');
      document.documentElement.style.setProperty('--bg-primary', '#fff5f5');
      document.documentElement.style.setProperty('--bg-secondary', '#ffebee');
      break;
      
    case 'chalkboard':
      document.body.className = 'theme-chalkboard';
      document.documentElement.style.setProperty('--primary', '#4ade80');
      document.documentElement.style.setProperty('--accent', '#22d3ee');
      document.documentElement.style.setProperty('--bg-primary', '#1f2937');
      document.documentElement.style.setProperty('--bg-secondary', '#374151');
      document.documentElement.style.setProperty('--text-primary', '#f9fafb');
      document.documentElement.style.setProperty('--text-secondary', '#d1d5db');
      document.documentElement.style.setProperty('--border', '#4b5563');
      break;
      
    case 'galaxy':
      document.body.className = 'theme-galaxy';
      document.documentElement.style.setProperty('--primary', '#8b5cf6');
      document.documentElement.style.setProperty('--accent', '#06b6d4');
      document.documentElement.style.setProperty('--bg-primary', '#0f0f23');
      document.documentElement.style.setProperty('--bg-secondary', '#1a1a3f');
      document.documentElement.style.setProperty('--text-primary', '#e0e7ff');
      document.documentElement.style.setProperty('--text-secondary', '#a5b4fc');
      document.documentElement.style.setProperty('--border', '#3730a3');
      break;
      
    case 'nature':
      document.body.className = 'theme-nature';
      document.documentElement.style.setProperty('--primary', '#059669');
      document.documentElement.style.setProperty('--accent', '#84cc16');
      document.documentElement.style.setProperty('--bg-primary', '#f0fdf4');
      document.documentElement.style.setProperty('--bg-secondary', '#dcfce7');
      document.documentElement.style.setProperty('--text-primary', '#14532d');
      break;
      
    default: // Modern default theme
      document.body.className = 'theme-default';
      // Reset to original CSS custom properties
      document.documentElement.style.setProperty('--primary', '#3b82f6');
      document.documentElement.style.setProperty('--accent', '#06b6d4');
      document.documentElement.style.setProperty('--bg-primary', '#ffffff');
      document.documentElement.style.setProperty('--bg-secondary', '#f8fafc');
      document.documentElement.style.setProperty('--text-primary', '#1e293b');
      document.documentElement.style.setProperty('--text-secondary', '#64748b');
      document.documentElement.style.setProperty('--border', '#e2e8f0');
      break;
  }
}