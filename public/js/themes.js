// Enhanced Theme System for Spelling Practice Application
// Themes and core functions defined first

// Enhanced theme system with improved consistency and accessibility
const themes = {
  default: {
    name: 'Modern (Default)',
    icon: '✨',
    colors: {
      '--primary': '#3b82f6',
      '--primary-dark': '#2563eb',
      '--primary-soft': '#dbeafe',
      '--accent': '#06b6d4',
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f8fafc',
      '--bg-tertiary': '#f1f5f9',
      '--text-primary': '#1e293b',
      '--text-secondary': '#64748b',
      '--text-muted': '#94a3b8',
      '--success': '#10b981',
      '--warning': '#f59e0b',
      '--error': '#ef4444',
      '--border': '#e2e8f0',
      '--border-color': '#e2e8f0',
      '--shadow': 'rgba(0, 0, 0, 0.1)',
      '--card-bg': '#ffffff'
    }
  },
  playground: {
    name: 'Playground',
    icon: '🎪',
    colors: {
      '--primary': '#ff6b6b',
      '--primary-dark': '#ff5252',
      '--primary-soft': '#ffebee',
      '--accent': '#4ecdc4',
      '--bg-primary': '#fff5f5',
      '--bg-secondary': '#ffebee',
      '--bg-tertiary': '#fce4ec',
      '--text-primary': '#2d3748',
      '--text-secondary': '#4a5568',
      '--text-muted': '#718096',
      '--success': '#10b981',
      '--warning': '#f59e0b',
      '--error': '#ef4444',
      '--border': '#fecdd3',
      '--border-color': '#fecdd3',
      '--shadow': 'rgba(255, 107, 107, 0.15)',
      '--card-bg': '#ffffff'
    }
  },
  chalkboard: {
    name: 'Chalkboard',
    icon: '🎓',
    colors: {
      '--primary': '#4ade80',
      '--primary-dark': '#22c55e',
      '--primary-soft': '#365314',
      '--accent': '#22d3ee',
      '--bg-primary': '#1f2937',
      '--bg-secondary': '#374151',
      '--bg-tertiary': '#4b5563',
      '--text-primary': '#f9fafb',
      '--text-secondary': '#d1d5db',
      '--text-muted': '#9ca3af',
      '--success': '#10b981',
      '--warning': '#fbbf24',
      '--error': '#f87171',
      '--border': '#4b5563',
      '--border-color': '#4b5563',
      '--shadow': 'rgba(0, 0, 0, 0.3)',
      '--card-bg': '#374151'
    }
  },
  galaxy: {
    name: 'Galaxy',
    icon: '🌌',
    colors: {
      '--primary': '#8b5cf6',
      '--primary-dark': '#7c3aed',
      '--primary-soft': '#2d1b69',
      '--accent': '#06b6d4',
      '--bg-primary': '#0f0f23',
      '--bg-secondary': '#1a1a3f',
      '--bg-tertiary': '#2a2a5f',
      '--text-primary': '#e0e7ff',
      '--text-secondary': '#a5b4fc',
      '--text-muted': '#818cf8',
      '--success': '#4ade80',
      '--warning': '#fbbf24',
      '--error': '#f87171',
      '--border': '#3730a3',
      '--border-color': '#3730a3',
      '--shadow': 'rgba(139, 92, 246, 0.2)',
      '--card-bg': '#1a1a3f'
    }
  },
  nature: {
    name: 'Nature',
    icon: '🌿',
    colors: {
      '--primary': '#059669',
      '--primary-dark': '#047857',
      '--primary-soft': '#dcfce7',
      '--accent': '#84cc16',
      '--bg-primary': '#f0fdf4',
      '--bg-secondary': '#dcfce7',
      '--bg-tertiary': '#bbf7d0',
      '--text-primary': '#14532d',
      '--text-secondary': '#166534',
      '--text-muted': '#22c55e',
      '--success': '#059669',
      '--warning': '#f59e0b',
      '--error': '#dc2626',
      '--border': '#86efac',
      '--border-color': '#86efac',
      '--shadow': 'rgba(5, 150, 105, 0.15)',
      '--card-bg': '#ffffff'
    }
  },
  ocean: {
    name: 'Ocean',
    icon: '🌊',
    colors: {
      '--primary': '#0ea5e9',
      '--primary-dark': '#0284c7',
      '--primary-soft': '#e0f2fe',
      '--accent': '#06b6d4',
      '--bg-primary': '#f0f9ff',
      '--bg-secondary': '#e0f2fe',
      '--bg-tertiary': '#bae6fd',
      '--text-primary': '#0c4a6e',
      '--text-secondary': '#0369a1',
      '--text-muted': '#0284c7',
      '--success': '#10b981',
      '--warning': '#f59e0b',
      '--error': '#ef4444',
      '--border': '#7dd3fc',
      '--border-color': '#7dd3fc',
      '--shadow': 'rgba(14, 165, 233, 0.15)',
      '--card-bg': '#ffffff'
    }
  },
  sunset: {
    name: 'Sunset',
    icon: '🌅',
    colors: {
      '--primary': '#f97316',
      '--primary-dark': '#ea580c',
      '--primary-soft': '#fed7aa',
      '--accent': '#f59e0b',
      '--bg-primary': '#fffbeb',
      '--bg-secondary': '#fef3c7',
      '--bg-tertiary': '#fed7aa',
      '--text-primary': '#9a3412',
      '--text-secondary': '#c2410c',
      '--text-muted': '#ea580c',
      '--success': '#10b981',
      '--warning': '#f59e0b',
      '--error': '#dc2626',
      '--border': '#fdba74',
      '--border-color': '#fdba74',
      '--shadow': 'rgba(249, 115, 22, 0.15)',
      '--card-bg': '#ffffff'
    }
  },
  dark: {
    name: 'Dark Mode',
    icon: '🌙',
    colors: {
      '--primary': '#6366f1',
      '--primary-dark': '#4f46e5',
      '--primary-soft': '#312e81',
      '--accent': '#06b6d4',
      '--bg-primary': '#111827',
      '--bg-secondary': '#1f2937',
      '--bg-tertiary': '#374151',
      '--text-primary': '#f9fafb',
      '--text-secondary': '#d1d5db',
      '--text-muted': '#9ca3af',
      '--success': '#10b981',
      '--warning': '#fbbf24',
      '--error': '#f87171',
      '--border': '#4b5563',
      '--border-color': '#4b5563',
      '--shadow': 'rgba(0, 0, 0, 0.5)',
      '--card-bg': '#1f2937'
    }
  }
};

function applyTheme(themeName) {
  // Remove existing theme classes
  document.body.className = '';
  
  // Get theme or default
  const theme = themes[themeName] || themes.default;
  
  // Apply theme class
  document.body.className = `theme-${themeName}`;
  
  // Apply all color variables
  Object.entries(theme.colors).forEach(([property, value]) => {
    document.documentElement.style.setProperty(property, value);
  });
  

}

// Theme management functions
function applySavedTheme() {
  const savedTheme = localStorage.getItem('theme') || localStorage.getItem('selectedTheme') || 'default';
  applyTheme(savedTheme);

  // Update both theme selectors
  const themeSelector = document.getElementById('themeSelect');
  const studentThemeSelector = document.getElementById('studentThemeSelect');
  
  if (themeSelector) themeSelector.value = savedTheme;
  if (studentThemeSelector) studentThemeSelector.value = savedTheme;
}

function changeTheme(themeName) {

  
  applyTheme(themeName);
  
  // Save the preference in both possible keys for compatibility
  localStorage.setItem('selectedTheme', themeName);
  localStorage.setItem('theme', themeName);
  
  // Update both theme selectors if they exist
  const adminThemeSelect = document.getElementById('themeSelect');
  const studentThemeSelect = document.getElementById('studentThemeSelect');
  
  if (adminThemeSelect) {
    adminThemeSelect.value = themeName;
  }
  if (studentThemeSelect) {
    studentThemeSelect.value = themeName;
  }
  
  const theme = themes[themeName] || themes.default;
  if (typeof showToast === 'function') {
    showToast(`Theme changed to ${theme.name}`);
  }
}

function getAvailableThemes() {
  return Object.entries(themes).map(([key, theme]) => ({
    value: key,
    label: `${theme.icon} ${theme.name}`
  }));
}

function updateThemeSelectors() {
  const selectors = ['themeSelect', 'studentThemeSelect'];
  const availableThemes = getAvailableThemes();
  
  selectors.forEach(selectorId => {
    const selector = document.getElementById(selectorId);
    if (selector) {
      const currentValue = selector.value;
      selector.innerHTML = '';
      
      availableThemes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme.value;
        option.textContent = theme.label;
        if (theme.value === currentValue) {
          option.selected = true;
        }
        selector.appendChild(option);
      });
    }
  });
}

// Make functions globally accessible
window.changeTheme = changeTheme;
window.updateThemeSelectors = updateThemeSelectors;

// Initialize themes when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {

  
  // Apply saved theme
  applySavedTheme();
  
  // Update theme selectors with current selection
  const savedTheme = localStorage.getItem('theme') || localStorage.getItem('selectedTheme') || 'default';
  setTimeout(() => {
    const adminThemeSelect = document.getElementById('themeSelect');
    const studentThemeSelect = document.getElementById('studentThemeSelect');
    
    if (adminThemeSelect) {
      adminThemeSelect.value = savedTheme;

    } else {

    }
    
    if (studentThemeSelect) {
      studentThemeSelect.value = savedTheme;

    } else {

    }
  }, 100);
});