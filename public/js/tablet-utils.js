// Tablet optimization utilities for Spelling Practice App

class TabletOptimizations {
    constructor() {
        this.isTablet = this.detectTablet();
        this.touchStartTime = 0;
        this.touchStartPos = { x: 0, y: 0 };
        
        if (this.isTablet) {
            this.init();
        }
    }
    
    detectTablet() {
        // Basic tablet detection
        const userAgent = navigator.userAgent.toLowerCase();
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isTabletSize = window.innerWidth >= 768 && window.innerWidth <= 1024;
        const isTabletUA = /tablet|ipad|playbook|silk/i.test(userAgent);
        
        return isTouch && (isTabletSize || isTabletUA);
    }
    
    init() {

        
        this.addTabletClasses();
        this.optimizeButtons();
        this.improveScrolling();
        this.addTouchFeedback();
        this.optimizeKeyboard();
        this.handleOrientationChange();
        
        // Initialize after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupTabletUI();
            });
        } else {
            this.setupTabletUI();
        }
    }
    
    addTabletClasses() {
        document.documentElement.classList.add('tablet-device');
        document.body.classList.add('tablet-optimized');
    }
    
    optimizeButtons() {
        // Add enhanced button interactions
        document.addEventListener('touchstart', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                const button = e.target.tagName === 'BUTTON' ? e.target : e.target.closest('button');
                button.classList.add('touch-active');
                
                this.touchStartTime = Date.now();
                this.touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            // Remove touch feedback after a short delay
            setTimeout(() => {
                document.querySelectorAll('.touch-active').forEach(btn => {
                    btn.classList.remove('touch-active');
                });
            }, 150);
        }, { passive: true });
        
        // Handle long press for additional options
        document.addEventListener('touchstart', (e) => {
            if (e.target.classList.contains('activity-option')) {
                this.longPressTimer = setTimeout(() => {
                    this.showActivityOptions(e.target);
                }, 800);
            }
        }, { passive: true });
        
        document.addEventListener('touchend', () => {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
            }
        }, { passive: true });
    }
    
    improveScrolling() {
        // Smooth scrolling for tablets
        document.documentElement.style.scrollBehavior = 'smooth';
        
        // Prevent bounce scrolling on iOS
        document.body.style.overscrollBehavior = 'none';
        
        // Add momentum scrolling
        const scrollableElements = document.querySelectorAll('.scrollable, .card, .adminTab');
        scrollableElements.forEach(el => {
            el.style.webkitOverflowScrolling = 'touch';
        });
    }
    
    addTouchFeedback() {
        // Add haptic feedback (if available)
        window.vibrate = window.vibrate || window.webkitVibrate || window.mozVibrate;
        
        // Visual touch feedback
        const style = document.createElement('style');
        style.textContent = `
            .tablet-device .touch-active {
                transform: scale(0.98) !important;
                transition: transform 0.1s ease-out !important;
                background-color: rgba(59, 130, 246, 0.1) !important;
            }
            
            .tablet-device button:active,
            .tablet-device .activity-option:active {
                transform: scale(0.95);
                transition: transform 0.1s ease-out;
            }
            
            .tablet-device input:focus,
            .tablet-device textarea:focus,
            .tablet-device canvas:focus {
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2) !important;
                border-color: var(--primary) !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    optimizeKeyboard() {
        // Prevent zoom on input focus for iOS
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (input.style.fontSize === '' || parseFloat(input.style.fontSize) < 16) {
                input.style.fontSize = '16px';
            }
        });
        
        // Auto-scroll to input when keyboard appears
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                setTimeout(() => {
                    input.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center',
                        inline: 'nearest'
                    });
                }, 300); // Wait for keyboard animation
            });
        });
    }
    
    handleOrientationChange() {
        let orientationTimeout;
        
        window.addEventListener('orientationchange', () => {
            // Clear existing timeout
            if (orientationTimeout) {
                clearTimeout(orientationTimeout);
            }
            
            // Wait for orientation change to complete
            orientationTimeout = setTimeout(() => {
                this.adjustForOrientation();
                
                // Re-focus current input if any
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                    activeElement.blur();
                    setTimeout(() => activeElement.focus(), 100);
                }
            }, 500);
        });
    }
    
    adjustForOrientation() {
        const isLandscape = window.innerWidth > window.innerHeight;
        
        if (isLandscape) {
            document.body.classList.add('tablet-landscape');
            document.body.classList.remove('tablet-portrait');
        } else {
            document.body.classList.add('tablet-portrait');
            document.body.classList.remove('tablet-landscape');
        }
        
        // Adjust game section for landscape
        const gameSection = document.getElementById('gameSection');
        const wordBox = document.getElementById('wordBox');
        
        if (gameSection && wordBox) {
            if (isLandscape) {
                gameSection.style.minHeight = '70vh';
                gameSection.style.display = 'flex';
                gameSection.style.flexDirection = 'column';
                gameSection.style.justifyContent = 'center';
            } else {
                gameSection.style.minHeight = 'auto';
                gameSection.style.display = 'block';
            }
        }
    }
    
    setupTabletUI() {
        // Enhance activity options with better touch targets
        const activityOptions = document.querySelectorAll('.activity-option');
        activityOptions.forEach((option, index) => {
            // Add touch ripple effect
            option.addEventListener('touchstart', (e) => {
                this.createRipple(e, option);
            });
            
            // Add accessibility improvements
            option.setAttribute('tabindex', '0');
            option.setAttribute('role', 'button');
            
            // Keyboard navigation
            option.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    option.click();
                }
            });
        });
        
        // Improve admin tabs for tablet
        const adminTabs = document.getElementById('adminTabs');
        if (adminTabs) {
            adminTabs.classList.add('tablet-optimized-tabs');
        }
        
        // Add swipe gestures for navigation (optional)
        this.addSwipeGestures();
    }
    
    createRipple(event, element) {
        const ripple = document.createElement('span');
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.touches[0].clientX - rect.left - size / 2;
        const y = event.touches[0].clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple-animation 0.6s ease-out;
            pointer-events: none;
            z-index: 1000;
        `;
        
        // Add ripple animation if not exists
        if (!document.getElementById('ripple-style')) {
            const style = document.createElement('style');
            style.id = 'ripple-style';
            style.textContent = `
                @keyframes ripple-animation {
                    to {
                        transform: scale(2);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
    
    addSwipeGestures() {
        let startX, startY, startTime;
        
        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startTime = Date.now();
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;
            
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const endTime = Date.now();
            
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const deltaTime = endTime - startTime;
            
            // Check if it's a swipe (fast, directional movement)
            if (deltaTime < 300 && Math.abs(deltaX) > 100 && Math.abs(deltaY) < 80) {
                if (deltaX > 0) {
                    // Swipe right
                    this.handleSwipeRight();
                } else {
                    // Swipe left
                    this.handleSwipeLeft();
                }
            }
            
            startX = startY = null;
        }, { passive: true });
    }
    
    handleSwipeLeft() {
        // Navigate forward or show next content
        console.log('👈 Swipe left detected');
    }
    
    handleSwipeRight() {
        // Navigate back or show previous content
        console.log('👉 Swipe right detected');
        
        // Go back to dashboard if in game/typing mode
        const gameSection = document.getElementById('gameSection');
        const typingSection = document.getElementById('typingSection');
        const bibleSection = document.getElementById('bibleSection');
        
        if (!gameSection.classList.contains('hidden') && typeof backToStudentDashboard === 'function') {
            backToStudentDashboard();
        } else if (!typingSection.classList.contains('hidden') && typeof returnToStudentPanel === 'function') {
            returnToStudentPanel();
        } else if (!bibleSection.classList.contains('hidden') && typeof returnToStudentPanel === 'function') {
            returnToStudentPanel();
        }
    }
    
    showActivityOptions(element) {
        // Show additional options on long press
        if (window.vibrate) {
            window.vibrate(50); // Haptic feedback
        }
        
        // Add visual feedback
        element.style.transform = 'scale(1.05)';
        element.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
        
        setTimeout(() => {
            element.style.transform = '';
            element.style.boxShadow = '';
        }, 200);
        

    }
    
    // Public methods
    vibrate(pattern = 50) {
        if (window.vibrate && this.isTablet) {
            window.vibrate(pattern);
        }
    }
    
    isTabletDevice() {
        return this.isTablet;
    }
}

// Initialize tablet optimizations
let tabletOptimizations = null;

document.addEventListener('DOMContentLoaded', () => {
    tabletOptimizations = new TabletOptimizations();
    
    // Make available globally
    window.tabletOptimizations = tabletOptimizations;
    

});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TabletOptimizations;
}