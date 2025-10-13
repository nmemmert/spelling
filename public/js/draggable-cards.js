/**
 * Enhanced Card Layout Manager
 * Much simpler and more intuitive card arrangement system
 */

class CardLayoutManager {
    constructor() {
        console.log('🔧 CardLayoutManager constructor called');
        this.currentLayout = 'grid'; // grid, columns, rows, custom
        this.gridContainer = null;
        this.cards = [];
        this.isEditMode = false;
        
        console.log('🔧 Calling init()...');
        this.init();
    }
    
    init() {
        console.log('🔧 Init called, document.readyState:', document.readyState);
        if (document.readyState === 'loading') {
            console.log('🔧 Document loading, adding DOMContentLoaded listener');
            document.addEventListener('DOMContentLoaded', () => {
                console.log('🔧 DOMContentLoaded fired, calling setup');
                this.setup();
            });
        } else {
            console.log('🔧 Document ready, calling setup immediately');
            this.setup();
        }
    }
    
    setup() {
        console.log('🔧 Setup method called');
        
        if (!this.findContainer()) {
            console.log('❌ Container not found, will retry');
            return; // Will retry automatically
        }
        
        // Quick layout controls removed as requested
        this.applyLayout('grid'); // Start with clean grid layout
        console.log('🎯 Enhanced Card Layout Manager initialized');
    }
    
    findContainer() {
        // Find the admin grid or container with cards
        this.gridContainer = document.querySelector('.admin-grid') || 
                           document.querySelector('.overview-grid') ||
                           document.querySelector('.container') ||
                           document.body;
        
        if (!this.gridContainer) {
            console.log('No container found, retrying in 1 second...');
            setTimeout(() => this.setup(), 1000);
            return false;
        }
        
        // Get all cards in the container (both .card and .stat-card)
        this.cards = Array.from(this.gridContainer.querySelectorAll('.card, .stat-card'));
        console.log(`Found container: ${this.gridContainer.className}`);
        console.log(`Found ${this.cards.length} cards to manage`);
        
        if (this.cards.length === 0) {
            console.log('No cards found, retrying in 1 second...');
            setTimeout(() => this.setup(), 1000);
            return false;
        }
        
        return true;
    }
    
    // Quick layout controls removed as requested
    }
    
    addHoverEffects() {
        const style = document.createElement('style');
        style.textContent = `
            .layout-btn:hover {
                background: var(--primary) !important;
                color: white !important;
                transform: translateY(-1px);
            }
            .layout-btn.active {
                background: var(--success) !important;
                color: white !important;
                border-color: var(--success) !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    applyLayout(layoutType, activeBtn = null) {
        console.log(`Applying layout: ${layoutType}`);
        console.log(`Container:`, this.gridContainer);
        console.log(`Cards:`, this.cards.length);
        
        if (!this.gridContainer || this.cards.length === 0) {
            console.log('No container or cards found, refreshing...');
            this.findContainer();
            if (!this.gridContainer || this.cards.length === 0) {
                this.showToast('No cards found to layout');
                return;
            }
        }
        
        this.currentLayout = layoutType;
        
        // Update active button
        document.querySelectorAll('.layout-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        if (activeBtn) activeBtn.classList.add('active');
        
        // Clear any existing drag mode
        this.exitEditMode();
        
        // Completely override existing styles with extreme specificity
        this.overrideExistingStyles();
        
        // Reset container styles and classes
        this.gridContainer.classList.remove('drag-mode', 'layout-grid', 'layout-columns', 'layout-rows', 'layout-stack');
        this.gridContainer.style.removeProperty('display');
        this.gridContainer.style.removeProperty('grid-template-columns');
        this.gridContainer.style.removeProperty('gap');
        this.gridContainer.style.removeProperty('padding');
        
        // Reset all cards to normal positioning
        this.cards.forEach(card => {
            card.style.removeProperty('position');
            card.style.removeProperty('left');
            card.style.removeProperty('top');
            card.style.removeProperty('width');
            card.style.removeProperty('height');
            card.style.removeProperty('transform');
            card.style.removeProperty('margin-bottom');
        });
        
        // Apply the selected layout
        switch (layoutType) {
            case 'grid':
                this.applyGridLayout();
                break;
            case 'columns':
                this.applyColumnsLayout();
                break;
            case 'rows':
                this.applyRowsLayout();
                break;
            case 'stack':
                this.applyStackLayout();
                break;
        }
        
        // Add visual feedback
        this.gridContainer.style.setProperty('transition', 'all 0.3s ease', 'important');
        this.gridContainer.style.setProperty('border', '2px dashed var(--primary)', 'important');
        
        setTimeout(() => {
            this.gridContainer.style.removeProperty('border');
        }, 1000);
        
        this.showToast(`Applied ${layoutType} layout`);
    }
    
    overrideExistingStyles() {
        // Create a super high-specificity style override
        const overrideId = 'layout-override-' + Date.now();
        const existingOverride = document.querySelector('#layout-override');
        if (existingOverride) existingOverride.remove();
        
        const overrideStyle = document.createElement('style');
        overrideStyle.id = 'layout-override';
        overrideStyle.textContent = `
            /* Nuclear option: override everything with extreme specificity */
            .admin-grid.layout-grid.admin-grid.layout-grid {
                display: grid !important;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)) !important;
            }
            .admin-grid.layout-columns.admin-grid.layout-columns {
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
            }
            .admin-grid.layout-rows.admin-grid.layout-rows {
                display: grid !important;
                grid-template-columns: 1fr !important;
            }
            .admin-grid.layout-stack.admin-grid.layout-stack {
                display: block !important;
                grid-template-columns: none !important;
            }
            
            @media screen and (min-width: 1px) and (max-width: 9999px) {
                .admin-grid.layout-grid { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)) !important; }
                .admin-grid.layout-columns { grid-template-columns: 1fr 1fr !important; }
                .admin-grid.layout-rows { grid-template-columns: 1fr !important; }
                .admin-grid.layout-stack { display: block !important; grid-template-columns: none !important; }
            }
        `;
        document.head.appendChild(overrideStyle);
        console.log('🔥 Applied nuclear CSS override');
    }
    
    applyGridLayout() {
        console.log('Applying grid layout');
        
        // Multiple methods to force the change
        this.gridContainer.classList.add('layout-grid');
        this.gridContainer.style.setProperty('display', 'grid', 'important');
        this.gridContainer.style.setProperty('grid-template-columns', 'repeat(auto-fit, minmax(300px, 1fr))', 'important');
        this.gridContainer.style.setProperty('gap', '1.5rem', 'important');
        this.gridContainer.style.setProperty('padding', '1rem', 'important');
        
        // Force reflow to ensure changes are applied
        this.gridContainer.offsetHeight;
        
        console.log('Grid layout applied - container classes:', this.gridContainer.className);
        console.log('Grid layout applied - container styles:', this.gridContainer.style.cssText);
    }
    
    applyColumnsLayout() {
        console.log('Applying 2-column layout');
        
        this.gridContainer.classList.add('layout-columns');
        this.gridContainer.style.setProperty('display', 'grid', 'important');
        this.gridContainer.style.setProperty('grid-template-columns', '1fr 1fr', 'important');
        this.gridContainer.style.setProperty('gap', '1.5rem', 'important');
        this.gridContainer.style.setProperty('padding', '1rem', 'important');
        
        this.gridContainer.offsetHeight; // Force reflow
        console.log('Column layout applied - classes:', this.gridContainer.className);
    }
    
    applyRowsLayout() {
        console.log('Applying single row layout');
        
        this.gridContainer.classList.add('layout-rows');
        this.gridContainer.style.setProperty('display', 'grid', 'important');
        this.gridContainer.style.setProperty('grid-template-columns', '1fr', 'important');
        this.gridContainer.style.setProperty('gap', '1rem', 'important');
        this.gridContainer.style.setProperty('padding', '1rem', 'important');
        
        this.gridContainer.offsetHeight; // Force reflow
        console.log('Row layout applied - classes:', this.gridContainer.className);
    }
    
    applyStackLayout() {
        console.log('Applying stack layout');
        
        this.gridContainer.classList.add('layout-stack');
        this.gridContainer.style.setProperty('display', 'block', 'important');
        this.gridContainer.style.setProperty('grid-template-columns', 'none', 'important');
        this.gridContainer.style.setProperty('padding', '1rem', 'important');
        
        this.cards.forEach((card, index) => {
            card.style.setProperty('margin-bottom', '1rem', 'important');
            card.style.setProperty('width', '100%', 'important');
        });
        
        this.gridContainer.offsetHeight; // Force reflow
        console.log('Stack layout applied - classes:', this.gridContainer.className);
    }
    
    toggleEditMode(btn) {
        this.isEditMode = !this.isEditMode;
        
        if (this.isEditMode) {
            this.enterEditMode(btn);
        } else {
            this.exitEditMode(btn);
        }
    }
    
    enterEditMode(btn) {
        btn.innerHTML = '✅ Done Editing';
        btn.style.background = 'var(--error)';
        
        // Enable individual card adjustments
        this.cards.forEach((card, index) => {
            this.makeCardAdjustable(card, index);
        });
        
        this.showEditModeHelp();
        this.showToast('Edit mode: Click buttons on cards to adjust them');
    }
    
    exitEditMode(btn) {
        if (btn) {
            btn.innerHTML = '✏️ Fine Tune';
            btn.style.background = 'var(--primary)';
        }
        
        // Remove all edit controls
        document.querySelectorAll('.card-edit-controls').forEach(el => el.remove());
        document.querySelectorAll('.edit-mode-help').forEach(el => el.remove());
        
        this.isEditMode = false;
    }
    
    makeCardAdjustable(card, index) {
        // Remove existing controls
        const existing = card.querySelector('.card-edit-controls');
        if (existing) existing.remove();
        
        const controls = document.createElement('div');
        controls.className = 'card-edit-controls';
        controls.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            display: flex;
            gap: 4px;
            z-index: 100;
        `;
        
        // Size buttons
        const sizeButtons = [
            { text: 'S', action: () => this.resizeCard(card, 'small') },
            { text: 'M', action: () => this.resizeCard(card, 'medium') },
            { text: 'L', action: () => this.resizeCard(card, 'large') }
        ];
        
        sizeButtons.forEach(btn => {
            const button = document.createElement('button');
            button.innerHTML = btn.text;
            button.style.cssText = `
                width: 24px;
                height: 24px;
                border: 1px solid var(--primary);
                background: white;
                border-radius: 4px;
                cursor: pointer;
                font-size: 10px;
                font-weight: bold;
            `;
            button.onclick = btn.action;
            controls.appendChild(button);
        });
        
        // Move buttons (for fine positioning)
        const moveButtons = [
            { text: '↑', action: () => this.moveCard(card, 'up') },
            { text: '↓', action: () => this.moveCard(card, 'down') },
            { text: '←', action: () => this.moveCard(card, 'left') },
            { text: '→', action: () => this.moveCard(card, 'right') }
        ];
        
        moveButtons.forEach(btn => {
            const button = document.createElement('button');
            button.innerHTML = btn.text;
            button.style.cssText = `
                width: 20px;
                height: 20px;
                border: 1px solid var(--secondary);
                background: var(--bg-secondary);
                border-radius: 3px;
                cursor: pointer;
                font-size: 10px;
            `;
            button.onclick = btn.action;
            controls.appendChild(button);
        });
        
        card.style.position = 'relative';
        card.appendChild(controls);
    }
    
    resizeCard(card, size) {
        const sizes = {
            small: { width: '250px', minHeight: '200px' },
            medium: { width: '350px', minHeight: '300px' },
            large: { width: '500px', minHeight: '400px' }
        };
        
        const sizeStyle = sizes[size];
        card.style.width = sizeStyle.width;
        card.style.minHeight = sizeStyle.minHeight;
        
        this.showToast(`Card resized to ${size}`);
    }
    
    moveCard(card, direction) {
        // For grid layouts, this reorders the card
        const currentIndex = Array.from(this.gridContainer.children).indexOf(card);
        let newIndex = currentIndex;
        
        switch (direction) {
            case 'up':
            case 'left':
                newIndex = Math.max(0, currentIndex - 1);
                break;
            case 'down':
            case 'right':
                newIndex = Math.min(this.gridContainer.children.length - 1, currentIndex + 1);
                break;
        }
        
        if (newIndex !== currentIndex) {
            const cards = Array.from(this.gridContainer.children);
            if (newIndex < currentIndex) {
                this.gridContainer.insertBefore(card, cards[newIndex]);
            } else {
                this.gridContainer.insertBefore(card, cards[newIndex].nextSibling);
            }
            this.showToast(`Card moved ${direction}`);
        }
    }
    
    showEditModeHelp() {
        const help = document.createElement('div');
        help.className = 'edit-mode-help';
        help.style.cssText = `
            position: fixed;
            top: 50%;
            right: 20px;
            transform: translateY(-50%);
            background: var(--primary);
            color: white;
            padding: 1rem;
            border-radius: 8px;
            font-size: 0.8rem;
            max-width: 200px;
            z-index: 999;
        `;
        help.innerHTML = `
            <strong>Edit Mode Help</strong><br>
            • S/M/L = Resize cards<br>
            • ↑↓←→ = Move cards<br>
            • Click "Done" when finished
        `;
        
        document.body.appendChild(help);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (help.parentNode) help.remove();
        }, 5000);
    }
    
    minimizeControls(controlsDiv) {
        const isMinimized = controlsDiv.dataset.minimized === 'true';
        
        if (isMinimized) {
            // Restore
            controlsDiv.style.width = '';
            controlsDiv.style.height = '';
            controlsDiv.querySelectorAll('button:not(:last-child)').forEach(btn => {
                btn.style.display = '';
            });
            controlsDiv.querySelector('div').style.display = '';
            controlsDiv.dataset.minimized = 'false';
            controlsDiv.querySelector('button:last-child').innerHTML = '−';
        } else {
            // Minimize
            controlsDiv.style.width = '40px';
            controlsDiv.style.height = '40px';
            controlsDiv.querySelectorAll('button:not(:last-child)').forEach(btn => {
                btn.style.display = 'none';
            });
            controlsDiv.querySelector('div').style.display = 'none';
            controlsDiv.dataset.minimized = 'true';
            controlsDiv.querySelector('button:last-child').innerHTML = '⚡';
        }
    }
    
    showToast(message) {
        // Remove existing toast
        const existing = document.querySelector('.layout-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.className = 'layout-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--success);
            color: white;
            padding: 0.75rem 1rem;
            border-radius: var(--radius);
            font-size: 0.9rem;
            font-family: inherit;
            font-weight: 500;
            z-index: 1001;
            box-shadow: var(--shadow-lg);
            animation: slideInUp 0.3s ease;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Auto-remove after 2 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOutDown 0.3s ease forwards';
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }, 2000);
    }
}

// Add CSS animations and layout overrides
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInUp {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes slideOutDown {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(100px); opacity: 0; }
    }
    
    /* Layout override styles with high specificity */
    .admin-grid.layout-grid,
    .overview-grid.layout-grid,
    .container.layout-grid {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)) !important;
        gap: 1.5rem !important;
        padding: 1rem !important;
    }
    
    .admin-grid.layout-columns,
    .overview-grid.layout-columns,
    .container.layout-columns {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 1.5rem !important;
        padding: 1rem !important;
    }
    
    .admin-grid.layout-rows,
    .overview-grid.layout-rows,
    .container.layout-rows {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 1rem !important;
        padding: 1rem !important;
    }
    
    .admin-grid.layout-stack,
    .overview-grid.layout-stack,
    .container.layout-stack {
        display: block !important;
        padding: 1rem !important;
    }
    
    .layout-stack .card {
        margin-bottom: 1rem !important;
        width: 100% !important;
    }
    
    /* Override media queries */
    @media (min-width: 1px) {
        .admin-grid.layout-grid,
        .overview-grid.layout-grid {
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)) !important;
        }
        .admin-grid.layout-columns,
        .overview-grid.layout-columns {
            grid-template-columns: 1fr 1fr !important;
        }
        .admin-grid.layout-rows,
        .overview-grid.layout-rows {
            grid-template-columns: 1fr !important;
        }
    }
`;
document.head.appendChild(style);

// Initialize the new system
console.log('🚀 Loading Card Layout Manager...');

try {
    window.cardLayoutManager = new CardLayoutManager();
    console.log('✅ Card Layout Manager created successfully');
} catch (error) {
    console.error('❌ Error creating Card Layout Manager:', error);
}