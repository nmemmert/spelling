/**
 * Draggable & Resizable Cards System
 * Allows admin cards to be dragged, dropped, and resized within the admin panel
 */

class DraggableCardManager {
    constructor() {
        this.cards = [];
        this.draggedCard = null;
        this.startPos = { x: 0, y: 0 };
        this.startSize = { width: 0, height: 0 };
        this.isResizing = false;
        this.isDragging = false;
        this.gridContainer = null;
        this.savedLayouts = this.loadSavedLayouts();
        
        this.init();
    }
    
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupDraggableCards());
        } else {
            this.setupDraggableCards();
        }
        
        console.log('🎯 Draggable Cards Manager initialized');
    }
    
    setupDraggableCards() {
        // Find all potential containers with cards
        const containers = [
            document.querySelector('.admin-grid'),
            document.querySelector('.container'),
            document.body
        ];
        
        // Use the first container found, or body as fallback
        this.gridContainer = containers.find(container => container && container.querySelector('.card')) || document.body;
        
        if (!this.gridContainer) {
            console.log('No container with cards found, retrying in 1 second...');
            setTimeout(() => this.setupDraggableCards(), 1000);
            return;
        }
        
        // Make the container suitable for absolute positioning
        if (this.gridContainer.style.position !== 'relative' && this.gridContainer.style.position !== 'absolute') {
            this.gridContainer.style.position = 'relative';
        }
        this.gridContainer.style.minHeight = '400px';
        
        // Setup all cards found anywhere on the page
        this.setupAllCards();
        
        // Load saved layout
        this.applySavedLayout();
        
        // Add control buttons
        this.addControlButtons();
        
        // Watch for new cards being added dynamically
        this.setupCardObserver();
        
        console.log('📋 Draggable cards setup complete for all pages');
    }
    
    setupAllCards() {
        // Find all cards on the entire page, not just in one container
        const allCards = document.querySelectorAll('.card');
        
        allCards.forEach((card, index) => {
            // Skip if already setup
            if (card.dataset.draggableSetup === 'true') return;
            
            this.makeCardDraggable(card, index);
            this.makeCardResizable(card, index);
            this.addCardHeader(card, index);
            
            card.dataset.draggableSetup = 'true';
        });
        
        console.log(`🎯 Setup ${allCards.length} draggable cards`);
    }
    
    setupCardObserver() {
        // Watch for new cards being added to the page
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node is a card or contains cards
                        const cards = node.classList && node.classList.contains('card') 
                            ? [node] 
                            : node.querySelectorAll ? node.querySelectorAll('.card') : [];
                        
                        cards.forEach((card, index) => {
                            if (card.dataset.draggableSetup !== 'true') {
                                const allCards = document.querySelectorAll('.card');
                                const cardIndex = Array.from(allCards).indexOf(card);
                                this.makeCardDraggable(card, cardIndex);
                                this.makeCardResizable(card, cardIndex);
                                this.addCardHeader(card, cardIndex);
                                card.dataset.draggableSetup = 'true';
                            }
                        });
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        this.cardObserver = observer;
    }
    
    autoArrangeCards() {
        const cards = this.freeformContainer.querySelectorAll('.card');
        const containerWidth = this.freeformContainer.clientWidth - 40; // Account for padding
        const cardWidth = 350; // Standard width for side-by-side
        const cardHeight = 300; // Standard height
        const gap = 20; // Gap between cards
        
        const cardsPerRow = Math.floor(containerWidth / (cardWidth + gap));
        
        cards.forEach((card, index) => {
            const row = Math.floor(index / cardsPerRow);
            const col = index % cardsPerRow;
            
            const x = 20 + (col * (cardWidth + gap));
            const y = 20 + (row * (cardHeight + gap));
            
            card.style.left = x + 'px';
            card.style.top = y + 'px';
            card.style.width = cardWidth + 'px';
        });
        
        console.log(`📐 Auto-arranged ${cards.length} cards in ${cardsPerRow} columns`);
    }
    
    setupCards() {
        const cards = this.gridContainer.querySelectorAll('.card');
        
        cards.forEach((card, index) => {
            this.makeCardDraggable(card, index);
            this.makeCardResizable(card, index);
            this.addCardHeader(card, index);
        });
    }
    
    makeCardDraggable(card, index) {
        // Add draggable handle
        const header = card.querySelector('.card-header') || this.createCardHeader(card);
        
        header.style.cursor = 'move';
        header.addEventListener('mousedown', (e) => this.startDrag(e, card, index));
        header.addEventListener('touchstart', (e) => this.startDrag(e, card, index));
        
        // Prevent text selection while dragging
        header.style.userSelect = 'none';
        header.style.webkitUserSelect = 'none';
    }
    
    makeCardResizable(card, index) {
        // Add resize handles
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        resizeHandle.innerHTML = '⟲';
        resizeHandle.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            width: 20px;
            height: 20px;
            cursor: se-resize;
            background: var(--primary);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            border-radius: 4px 0 8px 0;
            opacity: 0.7;
            transition: opacity 0.2s ease;
        `;
        
        resizeHandle.addEventListener('mousedown', (e) => this.startResize(e, card, index));
        resizeHandle.addEventListener('touchstart', (e) => this.startResize(e, card, index));
        
        card.style.position = 'relative';
        card.appendChild(resizeHandle);
        
        // Show/hide resize handle on hover
        card.addEventListener('mouseenter', () => resizeHandle.style.opacity = '1');
        card.addEventListener('mouseleave', () => resizeHandle.style.opacity = '0.7');
    }
    
    createCardHeader(card) {
        const header = document.createElement('div');
        header.className = 'card-header';
        header.style.cssText = `
            background: var(--primary);
            color: white;
            padding: 0.5rem 1rem;
            margin: -2rem -2rem 1rem -2rem;
            border-radius: 8px 8px 0 0;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
            opacity: 0.3;
            transition: opacity 0.3s ease;
        `;
        
        const title = card.querySelector('h4');
        const titleText = title ? title.textContent : `Card ${card.dataset.cardIndex || ''}`;
        header.innerHTML = `
            <span>${titleText}</span>
            <span class="drag-indicator" style="opacity: 0.7;">⋮⋮</span>
        `;
        
        card.insertBefore(header, card.firstChild);
        if (title) title.style.display = 'none'; // Hide original title
        
        return header;
    }
    
    addCardHeader(card, index) {
        card.dataset.cardIndex = index;
        
        if (!card.querySelector('.card-header')) {
            this.createCardHeader(card);
        }
    }
    
    startDrag(e, card, index) {
        // Only allow dragging if global drag mode is enabled
        if (!document.body.classList.contains('global-drag-mode')) {
            return;
        }
        
        e.preventDefault();
        
        this.isDragging = true;
        this.draggedCard = card;
        
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        
        const rect = card.getBoundingClientRect();
        this.startPos = {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
        
        // Switch to absolute positioning
        const parentRect = card.offsetParent ? card.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
        card.style.position = 'absolute';
        card.style.left = rect.left - parentRect.left + 'px';
        card.style.top = rect.top - parentRect.top + 'px';
        card.style.width = rect.width + 'px';
        card.style.zIndex = '1000';
        card.style.transform = 'rotate(2deg)';
        card.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
        
        // Add event listeners
        document.addEventListener('mousemove', this.handleDrag);
        document.addEventListener('touchmove', this.handleDrag);
        document.addEventListener('mouseup', this.stopDrag);
        document.addEventListener('touchend', this.stopDrag);
        
        card.classList.add('dragging');
    }
    
    handleDrag = (e) => {
        if (!this.isDragging || !this.draggedCard) return;
        
        e.preventDefault();
        
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        
        const containerRect = this.freeformContainer ? this.freeformContainer.getBoundingClientRect() : 
                              (this.draggedCard.offsetParent ? this.draggedCard.offsetParent.getBoundingClientRect() : { left: 0, top: 0 });
        const newX = clientX - containerRect.left - this.startPos.x;
        const newY = clientY - containerRect.top - this.startPos.y;
        
        // Keep within bounds of the container with some padding
        const container = this.freeformContainer || this.draggedCard.offsetParent || document.body;
        const maxX = container.clientWidth - this.draggedCard.offsetWidth - 10;
        const maxY = container.clientHeight - this.draggedCard.offsetHeight - 10;
        
        this.draggedCard.style.left = Math.max(0, Math.min(maxX, newX)) + 'px';
        this.draggedCard.style.top = Math.max(0, Math.min(maxY, newY)) + 'px';
    }
    
    stopDrag = (e) => {
        if (!this.isDragging || !this.draggedCard) return;
        
        this.isDragging = false;
        
        // Reset visual effects
        this.draggedCard.style.transform = '';
        this.draggedCard.style.zIndex = '';
        this.draggedCard.style.boxShadow = '';
        this.draggedCard.classList.remove('dragging');
        
        // Save position
        this.saveCardLayout();
        
        // Clean up event listeners
        document.removeEventListener('mousemove', this.handleDrag);
        document.removeEventListener('touchmove', this.handleDrag);
        document.removeEventListener('mouseup', this.stopDrag);
        document.removeEventListener('touchend', this.stopDrag);
        
        this.draggedCard = null;
    }
    
    startResize(e, card, index) {
        // Only allow resizing if global drag mode is enabled
        if (!document.body.classList.contains('global-drag-mode')) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        this.isResizing = true;
        this.draggedCard = card;
        
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        
        this.startPos = { x: clientX, y: clientY };
        this.startSize = {
            width: card.offsetWidth,
            height: card.offsetHeight
        };
        
        document.addEventListener('mousemove', this.handleResize);
        document.addEventListener('touchmove', this.handleResize);
        document.addEventListener('mouseup', this.stopResize);
        document.addEventListener('touchend', this.stopResize);
        
        card.classList.add('resizing');
    }
    
    handleResize = (e) => {
        if (!this.isResizing || !this.draggedCard) return;
        
        e.preventDefault();
        
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        
        const deltaX = clientX - this.startPos.x;
        const deltaY = clientY - this.startPos.y;
        
        const newWidth = Math.max(200, this.startSize.width + deltaX);
        const newHeight = Math.max(150, this.startSize.height + deltaY);
        
        this.draggedCard.style.width = newWidth + 'px';
        this.draggedCard.style.height = newHeight + 'px';
    }
    
    stopResize = (e) => {
        if (!this.isResizing) return;
        
        this.isResizing = false;
        this.draggedCard.classList.remove('resizing');
        
        // Save size
        this.saveCardLayout();
        
        // Clean up event listeners
        document.removeEventListener('mousemove', this.handleResize);
        document.removeEventListener('touchmove', this.handleResize);
        document.removeEventListener('mouseup', this.stopResize);
        document.removeEventListener('touchend', this.stopResize);
        
        this.draggedCard = null;
    }
    
    saveCardLayout() {
        const layout = {};
        const cards = this.gridContainer.querySelectorAll('.card');
        
        cards.forEach((card, index) => {
            layout[index] = {
                left: card.style.left,
                top: card.style.top,
                width: card.style.width,
                height: card.style.height,
                position: card.style.position
            };
        });
        
        localStorage.setItem('adminCardLayout', JSON.stringify(layout));
        console.log('💾 Card layout saved');
    }
    
    loadSavedLayouts() {
        try {
            const saved = localStorage.getItem('adminCardLayout');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.warn('Could not load saved layouts:', e);
            return {};
        }
    }
    
    applySavedLayout() {
        const cards = this.gridContainer.querySelectorAll('.card');
        
        cards.forEach((card, index) => {
            const savedLayout = this.savedLayouts[index];
            if (savedLayout) {
                Object.assign(card.style, savedLayout);
            }
        });
    }
    
    addControlButtons() {
        // Check if controls already exist
        if (document.querySelector('.global-card-controls')) return;
        
        // Check if hamburger menu exists and adjust position accordingly
        const menuToggle = document.querySelector('.menu-toggle');
        const topPosition = menuToggle ? '80px' : '20px';
        
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'global-card-controls card-controls';
        controlsDiv.style.cssText = `
            position: fixed;
            top: ${topPosition};
            left: 20px;
            z-index: 900;
            display: flex;
            gap: 0.5rem;
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(10px);
            border-radius: 8px;
            padding: 0.75rem;
            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
            border: 1px solid var(--border);
            max-width: 300px;
            flex-wrap: wrap;
        `;
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn btn-primary';
        toggleBtn.innerHTML = '🎯 Enable Drag Mode';
        toggleBtn.style.fontSize = '0.9rem';
        toggleBtn.onclick = () => this.toggleDragMode(toggleBtn);
        
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn btn-secondary';
        resetBtn.innerHTML = '🔄 Reset';
        resetBtn.style.fontSize = '0.9rem';
        resetBtn.onclick = () => this.resetLayout();
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-success';
        saveBtn.innerHTML = '💾 Save';
        saveBtn.style.fontSize = '0.9rem';
        saveBtn.onclick = () => this.saveCardLayout();
        
        const arrangeBtn = document.createElement('button');
        arrangeBtn.className = 'btn btn-info';
        arrangeBtn.innerHTML = '📐 Auto-Arrange';
        arrangeBtn.style.fontSize = '0.9rem';
        arrangeBtn.onclick = () => {
            if (document.body.classList.contains('global-drag-mode') && this.freeformContainer) {
                this.autoArrangeCards();
            }
        };
        
        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'btn btn-secondary';
        minimizeBtn.innerHTML = '−';
        minimizeBtn.style.fontSize = '1.2rem';
        minimizeBtn.style.width = '32px';
        minimizeBtn.style.padding = '0.25rem';
        minimizeBtn.title = 'Minimize controls';
        minimizeBtn.onclick = () => this.toggleControls(controlsDiv, minimizeBtn);
        
        controlsDiv.appendChild(toggleBtn);
        controlsDiv.appendChild(resetBtn);
        controlsDiv.appendChild(saveBtn);
        controlsDiv.appendChild(arrangeBtn);
        controlsDiv.appendChild(minimizeBtn);
        
        document.body.appendChild(controlsDiv);
        
        this.controlsDiv = controlsDiv;
        this.toggleBtn = toggleBtn;
        
        console.log('🎛️ Global card controls added');
    }
    
    toggleControls(controlsDiv, minimizeBtn) {
        const buttons = controlsDiv.querySelectorAll('.btn:not(:last-child)');
        const isMinimized = controlsDiv.dataset.minimized === 'true';
        
        if (isMinimized) {
            // Expand
            buttons.forEach(btn => btn.style.display = 'inline-flex');
            minimizeBtn.innerHTML = '−';
            minimizeBtn.title = 'Minimize controls';
            controlsDiv.dataset.minimized = 'false';
        } else {
            // Minimize
            buttons.forEach(btn => btn.style.display = 'none');
            minimizeBtn.innerHTML = '⚙️';
            minimizeBtn.title = 'Expand controls';
            controlsDiv.dataset.minimized = 'true';
        }
    }
    
    toggleDragMode(button) {
        const isCurrentlyEnabled = document.body.classList.contains('global-drag-mode');
        
        if (isCurrentlyEnabled) {
            // Disable drag mode
            document.body.classList.remove('global-drag-mode');
            button.innerHTML = '🎯 Enable Drag Mode';
            button.className = 'btn btn-primary';
            
            // Return cards to their original containers if possible
            const cards = document.querySelectorAll('.card');
            cards.forEach(card => {
                // Reset positioning
                card.style.position = '';
                card.style.left = '';
                card.style.top = '';
                card.style.zIndex = '';
                card.style.width = '';
                card.style.minWidth = '';
                
                // Move back to original container if it was in freeform container
                if (card.parentNode === this.freeformContainer) {
                    const originalContainer = document.querySelector('.admin-grid') || 
                                           document.querySelector('.container') || 
                                           document.body;
                    originalContainer.appendChild(card);
                }
            });
            
            // Hide freeform container
            if (this.freeformContainer) {
                this.freeformContainer.style.display = 'none';
            }
            
            // Remove drag mode indicator
            const indicator = document.querySelector('.global-drag-indicator');
            if (indicator) indicator.remove();
            
            console.log('🔒 Drag mode disabled - cards returned to normal layout');
        } else {
            // Enable drag mode
            document.body.classList.add('global-drag-mode');
            button.innerHTML = '🔒 Disable Drag Mode';
            button.className = 'btn btn-warning';
            
            // Add drag mode indicator
            this.addDragModeIndicator();
            
            // Create and show freeform container
            this.ensureFreeformContainer();
            this.freeformContainer.style.display = 'block';
            
            // Convert all cards to absolute positioning with flexible layout
            const cards = document.querySelectorAll('.card');
            
            cards.forEach((card, index) => {
                const rect = card.getBoundingClientRect();
                
                // Move card to freeform container if not already there
                if (card.parentNode !== this.freeformContainer) {
                    this.freeformContainer.appendChild(card);
                }
                
                const containerRect = this.freeformContainer.getBoundingClientRect();
                
                card.style.position = 'absolute';
                card.style.left = Math.max(10, (rect.left - containerRect.left)) + 'px';
                card.style.top = Math.max(10, (rect.top - containerRect.top)) + 'px';
                card.style.width = Math.min(400, Math.max(250, rect.width)) + 'px'; // Flexible width
                card.style.zIndex = '10';
                card.style.minWidth = '250px';
                card.style.maxWidth = '500px'; // Allow for side-by-side placement
            });
            
            // Auto-arrange cards in a grid-like pattern initially
            this.autoArrangeCards();
            
            console.log('🎯 Free-form drag mode enabled - cards can be placed side-by-side');
        }
    }
    
    ensureFreeformContainer() {
        // Create or get the freeform positioning container
        if (!this.freeformContainer || !document.body.contains(this.freeformContainer)) {
            this.freeformContainer = document.createElement('div');
            this.freeformContainer.className = 'freeform-card-container';
            this.freeformContainer.style.cssText = `
                position: relative;
                width: 100%;
                min-height: 100vh;
                padding: 2rem;
                box-sizing: border-box;
            `;
            
            // Find the main container to replace or append to
            const mainContainer = document.querySelector('.container') || document.body;
            if (mainContainer === document.body) {
                document.body.appendChild(this.freeformContainer);
            } else {
                mainContainer.parentNode.insertBefore(this.freeformContainer, mainContainer.nextSibling);
            }
        }
        return this.freeformContainer;
    }
    
    addDragModeIndicator() {
        // Remove existing indicator
        const existing = document.querySelector('.global-drag-indicator');
        if (existing) existing.remove();
        
        const indicator = document.createElement('div');
        indicator.className = 'global-drag-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: var(--primary);
            color: white;
            padding: 0.75rem;
            text-align: center;
            font-size: 0.9rem;
            z-index: 899;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        indicator.innerHTML = '🎯 Free-Form Layout Active - Drag cards anywhere, place them side-by-side, resize as needed';
        
        document.body.appendChild(indicator);
    }
    
    resetLayout() {
        const cards = this.gridContainer.querySelectorAll('.card');
        
        cards.forEach((card) => {
            card.style.position = '';
            card.style.left = '';
            card.style.top = '';
            card.style.width = '';
            card.style.height = '';
        });
        
        localStorage.removeItem('adminCardLayout');
        console.log('🔄 Layout reset');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.draggableCardManager = new DraggableCardManager();
    });
} else {
    window.draggableCardManager = new DraggableCardManager();
}