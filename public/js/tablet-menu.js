/**
 * Tablet Menu Management System
 * Handles collapsible navigation, touch gestures, and optimized menu interactions for tablets
 */

class TabletMenuManager {
    constructor() {
        this.isMenuExpanded = false;
        this.isMinimized = false;
        this.isWritingActive = false;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.swipeThreshold = 100;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.init();
    }
    
    init() {
        this.createMenuToggle();
        this.createMenuPopup();
        this.setupEventListeners();
        this.setupPopupDragging();
        this.setupHelpBubble();
        this.optimizeAdminTabs();
        this.createQuickActions();
        this.setupWritingAreaDetection();
        
        console.log('📱 Universal Popup Menu Manager initialized');
    }
    
    isTabletDevice() {
        // Check for tablet characteristics
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const screenSize = window.innerWidth >= 600 && window.innerWidth <= 1200;
        const isLandscape = window.innerWidth > window.innerHeight;
        const aspectRatio = window.innerWidth / window.innerHeight;
        
        return hasTouch && (screenSize || (isLandscape && aspectRatio < 2));
    }
    
    createMenuToggle() {
        // Remove existing toggle if present
        const existingToggle = document.querySelector('.menu-toggle');
        if (existingToggle) existingToggle.remove();
        
        const toggle = document.createElement('button');
        toggle.className = 'menu-toggle';
        toggle.innerHTML = '☰';
        toggle.setAttribute('aria-label', 'Toggle Navigation Menu');
        toggle.addEventListener('click', () => this.toggleMenu());
        
        document.body.appendChild(toggle);
        this.menuToggle = toggle;
    }
    
    createMenuPopup() {
        // Remove existing popup if present
        const existingPopup = document.querySelector('.menu-popup');
        if (existingPopup) existingPopup.remove();
        
        // Create popup container
        const popup = document.createElement('div');
        popup.className = 'menu-popup hidden';
        popup.id = 'menuPopup';
        
        // Create popup header
        const header = document.createElement('div');
        header.className = 'popup-header';
        header.innerHTML = `
            <div class="popup-title">
                <span class="popup-icon">📋</span>
                <span>Admin Functions</span>
            </div>
            <div class="popup-controls">
                <button class="minimize-btn" title="Minimize">−</button>
                <button class="close-btn" title="Close">×</button>
            </div>
        `;
        
        // Create popup content (will be populated by existing nav content)
        const content = document.createElement('div');
        content.className = 'popup-content';
        content.id = 'popupContent';
        
        popup.appendChild(header);
        popup.appendChild(content);
        document.body.appendChild(popup);
        
        this.menuPopup = popup;
        this.setupPopupControls();
    }
    
    setupPopupControls() {
        const minimizeBtn = this.menuPopup.querySelector('.minimize-btn');
        const closeBtn = this.menuPopup.querySelector('.close-btn');
        
        minimizeBtn.addEventListener('click', () => this.minimizePopup());
        closeBtn.addEventListener('click', () => this.closePopup());
    }
    
    setupPopupDragging() {
        const header = this.menuPopup.querySelector('.popup-header');
        
        header.addEventListener('mousedown', (e) => this.startDrag(e));
        header.addEventListener('touchstart', (e) => this.startDrag(e), { passive: false });
        
        document.addEventListener('mousemove', (e) => this.onDrag(e));
        document.addEventListener('touchmove', (e) => this.onDrag(e), { passive: false });
        
        document.addEventListener('mouseup', () => this.endDrag());
        document.addEventListener('touchend', () => this.endDrag());
    }
    
    startDrag(e) {
        this.isDragging = true;
        const rect = this.menuPopup.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        this.dragOffset.x = clientX - rect.left;
        this.dragOffset.y = clientY - rect.top;
        
        this.menuPopup.style.cursor = 'grabbing';
        e.preventDefault();
    }
    
    onDrag(e) {
        if (!this.isDragging) return;
        
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        const newX = clientX - this.dragOffset.x;
        const newY = clientY - this.dragOffset.y;
        
        // Keep popup within viewport bounds
        const maxX = window.innerWidth - this.menuPopup.offsetWidth;
        const maxY = window.innerHeight - this.menuPopup.offsetHeight;
        
        const constrainedX = Math.max(0, Math.min(newX, maxX));
        const constrainedY = Math.max(0, Math.min(newY, maxY));
        
        this.menuPopup.style.left = constrainedX + 'px';
        this.menuPopup.style.top = constrainedY + 'px';
        this.menuPopup.style.transform = 'none';
    }
    
    endDrag() {
        this.isDragging = false;
        this.menuPopup.style.cursor = 'default';
    }
    
    minimizePopup() {
        this.isMinimized = !this.isMinimized;
        const content = this.menuPopup.querySelector('.popup-content');
        const minimizeBtn = this.menuPopup.querySelector('.minimize-btn');
        
        if (this.isMinimized) {
            content.style.display = 'none';
            this.menuPopup.classList.add('minimized');
            minimizeBtn.innerHTML = '+';
            minimizeBtn.title = 'Restore';
        } else {
            content.style.display = 'block';
            this.menuPopup.classList.remove('minimized');
            minimizeBtn.innerHTML = '−';
            minimizeBtn.title = 'Minimize';
        }
    }
    
    closePopup() {
        this.menuPopup.classList.add('hidden');
        this.menuToggle.classList.remove('active');
        this.menuToggle.innerHTML = '☰';
        this.isMenuExpanded = false;
        this.isMinimized = false;
        this.showToast('Menu closed');
    }
    
    setupHelpBubble() {
        const helpBubble = document.getElementById('adminHelpBubble');
        if (!helpBubble) return;
        
        helpBubble.addEventListener('click', () => this.showHelpPopup());
        
        // Only show help bubble for admin users
        this.updateHelpBubbleVisibility();
    }
    
    updateHelpBubbleVisibility() {
        const helpBubble = document.getElementById('adminHelpBubble');
        const adminPanel = document.getElementById('adminPanel');
        
        if (helpBubble && adminPanel) {
            if (!adminPanel.classList.contains('hidden')) {
                helpBubble.style.display = 'flex';
            } else {
                helpBubble.style.display = 'none';
            }
        }
    }
    
    showHelpPopup() {
        // Create overlay if it doesn't exist
        let overlay = document.getElementById('helpOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'helpOverlay';
            overlay.className = 'help-overlay';
            
            const popup = document.createElement('div');
            popup.className = 'help-popup';
            
            const header = document.createElement('div');
            header.className = 'help-popup-header';
            header.innerHTML = `
                <div class="help-popup-title">
                    <span>📱</span>
                    <span>Admin Functions Guide</span>
                </div>
                <button class="help-close-btn" onclick="window.tabletMenuManager.closeHelpPopup()">×</button>
            `;
            
            const content = document.createElement('div');
            content.className = 'help-popup-content';
            
            // Copy content from hidden instructions
            const helpContent = document.getElementById('adminHelpContent');
            if (helpContent) {
                content.innerHTML = helpContent.innerHTML;
            }
            
            popup.appendChild(header);
            popup.appendChild(content);
            overlay.appendChild(popup);
            document.body.appendChild(overlay);
            
            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeHelpPopup();
                }
            });
            
            // Close on escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.closeHelpPopup();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }
        
        // Show overlay
        setTimeout(() => {
            overlay.classList.add('visible');
        }, 10);
        
        this.showToast('Help opened');
    }
    
    closeHelpPopup() {
        const overlay = document.getElementById('helpOverlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }
        this.showToast('Help closed');
    }
    
    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isMenuExpanded) {
                this.closeMenu();
            }
            if (e.ctrlKey && e.key === 'm') {
                e.preventDefault();
                this.toggleMenu();
            }
        });
        
        // Click outside to close menu
        document.addEventListener('click', (e) => {
            const nav = document.getElementById('nav');
            if (this.isMenuExpanded && 
                !nav.contains(e.target) && 
                !this.menuToggle.contains(e.target)) {
                this.closeMenu();
            }
        });
        
        // Orientation change handling
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleOrientationChange(), 100);
        });
        
        // Resize handling
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }
    
    setupSwipeGestures() {
        let startX, startY, startTime;
        
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                startTime = Date.now();
            }
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 1) {
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                const endTime = Date.now();
                
                const deltaX = endX - startX;
                const deltaY = endY - startY;
                const deltaTime = endTime - startTime;
                
                // Swipe detection
                if (Math.abs(deltaX) > Math.abs(deltaY) && 
                    Math.abs(deltaX) > this.swipeThreshold && 
                    deltaTime < 500) {
                    
                    if (deltaX > 0 && startX < 50) {
                        // Swipe right from left edge - open menu
                        this.openMenu();
                    } else if (deltaX < 0 && this.isMenuExpanded) {
                        // Swipe left when menu open - close menu
                        this.closeMenu();
                    }
                }
            }
        }, { passive: true });
    }
    
    optimizeAdminTabs() {
        const adminTabs = document.getElementById('adminTabs');
        if (!adminTabs) return;
        
        // Add scroll indicators
        this.addScrollIndicators(adminTabs);
        
        // Smooth scrolling for tab navigation
        adminTabs.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            e.preventDefault();
            adminTabs.scrollLeft += e.deltaY;
        }, { passive: false });
        
        // Center active tab
        const activeTab = adminTabs.querySelector('button.active');
        if (activeTab) {
            this.scrollToTab(activeTab);
        }
    }
    
    addScrollIndicators(container) {
        const leftIndicator = document.createElement('div');
        leftIndicator.className = 'scroll-indicator left';
        leftIndicator.innerHTML = '‹';
        
        const rightIndicator = document.createElement('div');
        rightIndicator.className = 'scroll-indicator right';
        rightIndicator.innerHTML = '›';
        
        container.parentNode.insertBefore(leftIndicator, container);
        container.parentNode.appendChild(rightIndicator);
        
        // Update indicators on scroll
        const updateIndicators = () => {
            leftIndicator.style.opacity = container.scrollLeft > 0 ? '1' : '0.3';
            rightIndicator.style.opacity = 
                container.scrollLeft < container.scrollWidth - container.clientWidth ? '1' : '0.3';
        };
        
        container.addEventListener('scroll', updateIndicators);
        updateIndicators();
        
        // Click handlers
        leftIndicator.addEventListener('click', () => {
            container.scrollBy({ left: -120, behavior: 'smooth' });
        });
        
        rightIndicator.addEventListener('click', () => {
            container.scrollBy({ left: 120, behavior: 'smooth' });
        });
    }
    
    scrollToTab(tab) {
        const container = tab.parentNode;
        const tabRect = tab.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        if (tabRect.left < containerRect.left || tabRect.right > containerRect.right) {
            tab.scrollIntoView({ behavior: 'smooth', inline: 'center' });
        }
    }
    
    createQuickActions() {
        // Remove existing quick actions
        const existing = document.querySelector('.quick-actions');
        if (existing) existing.remove();
        
        const quickActions = document.createElement('div');
        quickActions.className = 'quick-actions';
        
        // Back to top button
        const backToTop = document.createElement('button');
        backToTop.className = 'quick-action-btn secondary';
        backToTop.innerHTML = '↑';
        backToTop.title = 'Back to Top';
        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        
        quickActions.appendChild(backToTop);
        
        // Show/hide based on scroll position
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset > 200;
            backToTop.style.opacity = scrolled ? '1' : '0';
            backToTop.style.pointerEvents = scrolled ? 'auto' : 'none';
        });
        
        document.body.appendChild(quickActions);
    }
    
    setupWritingAreaDetection() {
        // Detect when user is actively writing
        const writingAreas = [
            '#unifiedWriteContainer canvas',
            '#handwritingCanvas',
            '#userInput'
        ];
        
        writingAreas.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.addEventListener('focus', () => this.setWritingMode(true));
                element.addEventListener('blur', () => this.setWritingMode(false));
                
                if (element.tagName === 'CANVAS') {
                    element.addEventListener('pointerdown', () => this.setWritingMode(true));
                    element.addEventListener('touchstart', () => this.setWritingMode(true));
                }
            }
        });
        
        // Auto-close menu when writing starts
        document.addEventListener('touchstart', (e) => {
            const isWritingArea = writingAreas.some(selector => {
                const element = document.querySelector(selector);
                return element && element.contains(e.target);
            });
            
            if (isWritingArea && this.isMenuExpanded) {
                setTimeout(() => this.closeMenu(), 100);
            }
        });
    }
    
    setWritingMode(active) {
        this.isWritingActive = active;
        document.body.classList.toggle('writing-focused', active);
        
        if (active && this.isMenuExpanded) {
            this.closeMenu();
        }
    }
    
    toggleMenu() {
        if (this.isMenuExpanded) {
            this.closePopup();
        } else {
            this.openPopup();
        }
    }
    
    openPopup() {
        // Move navigation content to popup
        this.populatePopupContent();
        
        // Show popup
        this.menuPopup.classList.remove('hidden');
        this.menuToggle.classList.add('active');
        this.menuToggle.innerHTML = '✕';
        
        // Position popup in center initially
        if (!this.menuPopup.style.left || !this.menuPopup.style.top) {
            this.centerPopup();
        }
        
        this.isMenuExpanded = true;
    }
    
    populatePopupContent() {
        const content = this.menuPopup.querySelector('.popup-content');
        const nav = document.getElementById('nav');
        
        if (nav && content) {
            // Clone the navigation content
            content.innerHTML = nav.innerHTML;
        }
    }
    
    centerPopup() {
        const rect = this.menuPopup.getBoundingClientRect();
        const x = (window.innerWidth - rect.width) / 2;
        const y = (window.innerHeight - rect.height) / 2;
        
        this.menuPopup.style.left = Math.max(20, x) + 'px';
        this.menuPopup.style.top = Math.max(20, y) + 'px';
        this.menuPopup.style.transform = 'none';
        
        this.showToast('Menu opened');
        
        // Focus first interactive element
        setTimeout(() => {
            const firstButton = this.menuPopup.querySelector('button');
            if (firstButton) firstButton.focus();
        }, 300);
    }
    
    closeMenu() {
        // Keep this method for backward compatibility
        this.closePopup();
    }
    
    showToast(message, duration = 2000) {
        // Remove existing toasts
        document.querySelectorAll('.toast').forEach(toast => toast.remove());
        
        // Create toast container if needed
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        // Create toast
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    handleOrientationChange() {
        const nav = document.getElementById('nav');
        if (!nav) return;
        
        const isLandscape = window.innerWidth > window.innerHeight;
        
        if (isLandscape && window.innerWidth >= 900) {
            nav.classList.add('landscape');
            document.body.classList.toggle('landscape-nav-expanded', this.isMenuExpanded);
        } else {
            nav.classList.remove('landscape');
            document.body.classList.remove('landscape-nav-expanded');
        }
        
        // Reoptimize admin tabs
        setTimeout(() => this.optimizeAdminTabs(), 100);
    }
    
    handleResize() {
        if (!this.isTabletDevice() && this.isMenuExpanded) {
            this.closeMenu();
        }
        
        // Re-evaluate tablet status
        if (this.isTabletDevice() && !this.menuToggle) {
            this.createMenuToggle();
        } else if (!this.isTabletDevice() && this.menuToggle) {
            this.menuToggle.remove();
            this.menuToggle = null;
        }
    }
    
    // Enhanced navigation functions
    updateUserInfo() {
        const userInfo = document.getElementById('userInfo');
        const userBadge = document.getElementById('userBadge');
        
        if (window.currentUser) {
            const { username, role } = window.currentUser;
            
            // Don't override if userInfo already has content from main UI
            if (userInfo && !userInfo.textContent.includes('(')) {
                userInfo.textContent = `Welcome, ${username}`;
            }
            
            if (userBadge) {
                userBadge.textContent = role === 'admin' ? '👨‍💼 Admin' : '🎓 Student';
                userBadge.style.background = role === 'admin' ? 'var(--error)' : 'var(--primary)';
            }
            
            this.showRoleSpecificMenu(role);
        }
    }
    
    showRoleSpecificMenu(role) {
        const studentNav = document.getElementById('studentNavItems');
        const adminNav = document.getElementById('adminNavItems');
        
        if (role === 'admin') {
            if (studentNav) studentNav.classList.add('hidden');
            if (adminNav) adminNav.classList.remove('hidden');
        } else {
            if (adminNav) adminNav.classList.add('hidden');
            if (studentNav) studentNav.classList.remove('hidden');
        }
    }
    
    // Public API methods
    isMenuOpen() {
        return this.isMenuExpanded;
    }
    
    forceCloseMenu() {
        this.closeMenu();
    }
    
    updateNavigation() {
        this.updateUserInfo();
    }
    
    setTabActive(tabId) {
        const adminTabs = document.getElementById('adminTabs');
        if (!adminTabs) return;
        
        const tab = adminTabs.querySelector(`[data-tab="${tabId}"]`);
        if (tab) {
            // Remove active class from all tabs
            adminTabs.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            
            // Add active class to selected tab
            tab.classList.add('active');
            
            // Scroll to active tab
            this.scrollToTab(tab);
        }
    }
}

// Initialize tablet menu manager when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait for other systems to initialize
    setTimeout(() => {
        try {
            window.tabletMenuManager = new TabletMenuManager();
        } catch (error) {
            console.warn('Tablet Menu Manager failed to initialize:', error);
        }
    }, 1000); // Increased delay to ensure other systems are ready
});

// Handle admin tab clicks to update active state
document.addEventListener('click', function(e) {
    if (e.target.matches('#adminTabs button[data-tab]')) {
        if (window.tabletMenuManager) {
            window.tabletMenuManager.setTabActive(e.target.dataset.tab);
        }
    }
});

// Helper functions for enhanced navigation
function closeMenuIfTablet() {
    if (window.tabletMenuManager && window.tabletMenuManager.isMenuOpen()) {
        window.tabletMenuManager.forceCloseMenu();
    }
}

function showAdminTab(tabId) {
    // Show admin panel first
    if (window.showAdmin) {
        window.showAdmin();
    }
    
    // Then activate the specific tab
    setTimeout(() => {
        // Hide the dashboard overview
        const adminOverview = document.querySelector('.admin-overview');
        const menuInstructions = document.querySelector('.menu-instructions');
        if (adminOverview) adminOverview.style.display = 'none';
        if (menuInstructions) menuInstructions.style.display = 'none';
        
        // Don't show the old admin tabs interface - keep it hidden
        const adminTabsContainer = document.querySelector('#adminTabs').parentElement;
        if (adminTabsContainer) {
            adminTabsContainer.style.display = 'none';
        }
        
        // Show the specific admin tab content directly
        document.querySelectorAll('.adminTab').forEach(tab => {
            tab.classList.add('hidden');
        });
        
        const targetTab = document.getElementById(tabId);
        if (targetTab) {
            targetTab.classList.remove('hidden');
            targetTab.style.display = 'block';
        }
        
        // Add a back to dashboard button
        addBackToDashboardButton();
    }, 100);
}

function showChallenges() {
    // Navigate to student dashboard first
    if (window.showStudent) {
        window.showStudent();
    }
    
    // Scroll to challenges section
    setTimeout(() => {
        const challengesContainer = document.getElementById('challengesContainer');
        if (challengesContainer) {
            challengesContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 300);
}

function showLeaderboards() {
    // Navigate to student dashboard first
    if (window.showStudent) {
        window.showStudent();
    }
    
    // Scroll to leaderboards section
    setTimeout(() => {
        const leaderboardsContainer = document.getElementById('leaderboardsContainer');
        if (leaderboardsContainer) {
            leaderboardsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 300);
}

function showBadges() {
    // Navigate to student dashboard first
    if (window.showStudent) {
        window.showStudent();
    }
    
    // Scroll to user stats which includes badges
    setTimeout(() => {
        const userStatsContainer = document.getElementById('userStatsContainer');
        if (userStatsContainer) {
            userStatsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 300);
}

function showThemeSelector() {
    // Navigate to student dashboard first
    if (window.showStudent) {
        window.showStudent();
    }
    
    // Focus on theme selector
    setTimeout(() => {
        const themeSelect = document.getElementById('studentThemeSelect');
        if (themeSelect) {
            themeSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
            themeSelect.focus();
        }
    }, 300);
}

function showInputSettings() {
    // Show unified write mode if available
    if (window.unifiedWriteMode) {
        // Navigate to student dashboard first
        if (window.showStudent) {
            window.showStudent();
        }
        
        setTimeout(() => {
            // Start a game to show the input system
            if (window.startGame) {
                window.startGame();
            }
        }, 300);
    }
}

// Update navigation when user changes
function updateNavigationForUser() {
    try {
        if (window.tabletMenuManager) {
            window.tabletMenuManager.updateNavigation();
        } else {
            // Fallback: update navigation elements directly
            updateNavigationFallback();
        }
    } catch (error) {
        console.warn('Navigation update failed:', error);
        updateNavigationFallback();
    }
}

function updateNavigationFallback() {
    if (window.currentUser) {
        const { role } = window.currentUser;
        const studentNav = document.getElementById('studentNavItems');
        const adminNav = document.getElementById('adminNavItems');
        
        if (role === 'admin') {
            if (studentNav) studentNav.classList.add('hidden');
            if (adminNav) adminNav.classList.remove('hidden');
        } else {
            if (adminNav) adminNav.classList.add('hidden');
            if (studentNav) studentNav.classList.remove('hidden');
        }
    }
}

function addBackToDashboardButton() {
    // Remove existing back button
    const existingButton = document.querySelector('.back-to-dashboard');
    if (existingButton) existingButton.remove();
    
    // Add back button to admin panel
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) {
        const backButton = document.createElement('button');
        backButton.className = 'back-to-dashboard btn-secondary';
        backButton.innerHTML = '← Back to Dashboard';
        backButton.style.cssText = 'margin-bottom: 1rem; display: inline-block;';
        backButton.onclick = showAdminDashboard;
        
        // Insert at the beginning of admin panel
        const firstChild = adminPanel.firstElementChild;
        if (firstChild) {
            adminPanel.insertBefore(backButton, firstChild);
        }
    }
}

function showAdminDashboard() {
    // Show the dashboard overview
    const adminOverview = document.querySelector('.admin-overview');
    const menuInstructions = document.querySelector('.menu-instructions');
    if (adminOverview) adminOverview.style.display = 'block';
    if (menuInstructions) menuInstructions.style.display = 'block';
    
    // Hide the admin tabs container
    const adminTabs = document.getElementById('adminTabs');
    if (adminTabs && adminTabs.parentElement) {
        adminTabs.parentElement.style.display = 'none';
    }
    
    // Hide all admin tab content
    document.querySelectorAll('.adminTab').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Remove back button
    const backButton = document.querySelector('.back-to-dashboard');
    if (backButton) backButton.remove();
    
    // Load dashboard stats
    loadAdminDashboardStats();
}

function loadAdminDashboardStats() {
    // Update stats with real data from server
    try {
        // Fetch and display total users
        fetchDashboardStat('/getUsers', 'totalUsers', (data) => {
            return Array.isArray(data) ? data.length : Object.keys(data).length;
        });
        
        // Fetch and display total word lists
        fetchDashboardStat('/getWordlistsRaw', 'totalWordLists', (data) => {
            return Object.keys(data).length;
        });
        
        // Fetch and display total badges awarded
        fetchDashboardStat('/getBadges', 'totalBadges', (data) => {
            let totalAwarded = 0;
            if (data && typeof data === 'object') {
                Object.values(data).forEach(userBadges => {
                    if (Array.isArray(userBadges)) {
                        totalAwarded += userBadges.length;
                    }
                });
            }
            return totalAwarded;
        });
        
        // Calculate active sessions (users who have results in last 24 hours)
        fetchDashboardStat('/getResults', 'totalSessions', (data) => {
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            let activeSessions = 0;
            if (data && Array.isArray(data)) {
                const recentUsers = new Set();
                data.forEach(result => {
                    if (result.timestamp && new Date(result.timestamp).getTime() > oneDayAgo) {
                        recentUsers.add(result.username);
                    }
                });
                activeSessions = recentUsers.size;
            }
            return activeSessions;
        });
        
        // Update last updated timestamp
        updateLastUpdatedTime();
        
        // Set up auto-refresh every 30 seconds
        if (!window.dashboardStatsInterval) {
            window.dashboardStatsInterval = setInterval(() => {
                loadAdminDashboardStats();
            }, 30000);
        }
        
    } catch (error) {
        console.warn('Could not load dashboard stats:', error);
    }
}

// Update the last updated timestamp
function updateLastUpdatedTime() {
    const element = document.getElementById('lastUpdated');
    if (element) {
        const now = new Date();
        element.textContent = `Last updated: ${now.toLocaleTimeString()}`;
    }
}

// Helper function to fetch and update dashboard statistics
function fetchDashboardStat(endpoint, elementId, processor) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Show loading state
    const originalText = element.textContent;
    element.style.opacity = '0.6';
    element.style.transform = 'scale(0.95)';
    
    fetch(endpoint)
        .then(response => response.json())
        .then(data => {
            const value = processor(data);
            setTimeout(() => {
                element.textContent = value;
                element.style.opacity = '1';
                element.style.transform = 'scale(1.05)';
                
                // Add success pulse animation
                setTimeout(() => {
                    element.style.transform = 'scale(1)';
                    element.style.color = 'var(--success)';
                    setTimeout(() => {
                        element.style.color = 'var(--text-primary)';
                    }, 500);
                }, 150);
            }, 200);
        })
        .catch(error => {
            console.warn(`Failed to fetch ${endpoint}:`, error);
            element.textContent = originalText === '-' ? '!' : originalText;
            element.style.opacity = '0.7';
            element.style.transform = 'scale(1)';
            element.style.color = 'var(--error)';
            setTimeout(() => {
                element.style.color = 'var(--text-primary)';
            }, 1000);
        });
}

// Export for use in other scripts
window.TabletMenuManager = TabletMenuManager;