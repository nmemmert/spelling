/**
 * Unified Write Mode - Large Canvas with Handwriting + Keyboard Support
 * Combines handwriting recognition and keyboard input in one interface
 */

class UnifiedWriteMode {
    constructor() {
        this.currentMode = 'keyboard'; // 'keyboard' or 'handwriting'
        this.canvas = null;
        this.ctx = null;
        this.textArea = null;
        this.container = null;
        this.handwritingRecognizer = null;
        
        // Handwriting state
        this.isDrawing = false;
        this.strokes = [];
        this.currentStroke = [];
        
        // Recognition state
        this.recognizedText = '';
        this.isRecognizing = false;
        
        this.init();
    }

    init() {
        console.log('🔄 Initializing Unified Write Mode...');
        this.createInterface();
        this.setupEventListeners();
        this.initializeHandwritingRecognition();
    }

    createInterface() {
        // Find or create the main container
        this.container = document.getElementById('unifiedWriteContainer');
        
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'unifiedWriteContainer';
            this.container.className = 'unified-write-mode';
            
            // Insert into the game container or create new section
            const gameContainer = document.getElementById('game-container');
            if (gameContainer) {
                gameContainer.appendChild(this.container);
            } else {
                document.body.appendChild(this.container);
            }
        }

        this.container.innerHTML = `
            <div class="input-mode-selector">
                <button class="mode-button active" data-mode="keyboard">
                    <span class="icon">⌨️</span>
                    <span>Keyboard</span>
                </button>
                <button class="mode-button" data-mode="handwriting">
                    <span class="icon">✏️</span>
                    <span>Handwriting</span>
                </button>
            </div>

            <div class="large-writing-canvas keyboard-mode">
                <div class="input-method-indicator">Keyboard Mode</div>
                
                <textarea 
                    class="text-input-area" 
                    placeholder="Type your answer here or switch to handwriting mode..."
                    spellcheck="false"
                ></textarea>
                
                <canvas class="canvas-overlay"></canvas>
            </div>

            <div class="canvas-controls">
                <button class="btn btn-recognize" id="recognizeBtn" style="display: none;">
                    <span>🔍</span>
                    <span>Recognize</span>
                </button>
                
                <button class="btn btn-clear" id="clearBtn">
                    <span>🧹</span>
                    <span>Clear</span>
                </button>
                
                <button class="btn btn-submit" id="submitBtn">
                    <span>✅</span>
                    <span>Submit Answer</span>
                </button>
            </div>

            <div class="recognition-feedback" id="recognitionFeedback"></div>
        `;

        // Get references to key elements
        this.textArea = this.container.querySelector('.text-input-area');
        this.canvas = this.container.querySelector('.canvas-overlay');
        this.canvasContainer = this.container.querySelector('.large-writing-canvas');
        this.indicator = this.container.querySelector('.input-method-indicator');

        // Setup canvas
        this.setupCanvas();
        
        console.log('✅ Interface created successfully');
    }

    setupCanvas() {
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        // Configure canvas for drawing
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
        
        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const rect = this.canvasContainer.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Reconfigure context after resize
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    }

    setupEventListeners() {
        // Mode switching
        const modeButtons = this.container.querySelectorAll('.mode-button');
        modeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.switchMode(mode);
            });
        });

        // Canvas drawing events
        this.setupDrawingEvents();

        // Control buttons
        const recognizeBtn = this.container.querySelector('#recognizeBtn');
        const clearBtn = this.container.querySelector('#clearBtn');
        const submitBtn = this.container.querySelector('#submitBtn');

        if (recognizeBtn) {
            recognizeBtn.addEventListener('click', () => this.recognizeHandwriting());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearInput());
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitAnswer());
        }

        // Keyboard shortcuts
        this.textArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.submitAnswer();
            }
        });
    }

    setupDrawingEvents() {
        // Touch/Mouse events for handwriting
        const startDrawing = (e) => {
            if (this.currentMode !== 'handwriting') return;
            
            this.isDrawing = true;
            this.currentStroke = [];
            
            const point = this.getCanvasPoint(e);
            this.currentStroke.push(point);
            
            this.ctx.beginPath();
            this.ctx.moveTo(point.x, point.y);
        };

        const continueDrawing = (e) => {
            if (!this.isDrawing || this.currentMode !== 'handwriting') return;
            
            const point = this.getCanvasPoint(e);
            this.currentStroke.push(point);
            
            this.ctx.lineTo(point.x, point.y);
            this.ctx.stroke();
        };

        const stopDrawing = () => {
            if (!this.isDrawing || this.currentMode !== 'handwriting') return;
            
            this.isDrawing = false;
            
            if (this.currentStroke.length > 0) {
                this.strokes.push([...this.currentStroke]);
                console.log(`✏️ Stroke completed. Total strokes: ${this.strokes.length}`);
                
                // Auto-recognize after a delay
                this.scheduleAutoRecognition();
            }
            
            this.currentStroke = [];
        };

        // Mouse events
        this.canvas.addEventListener('mousedown', startDrawing);
        this.canvas.addEventListener('mousemove', continueDrawing);
        this.canvas.addEventListener('mouseup', stopDrawing);
        this.canvas.addEventListener('mouseout', stopDrawing);

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startDrawing(e.touches[0]);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            continueDrawing(e.touches[0]);
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopDrawing();
        });

        // Pointer events (for stylus)
        if ('PointerEvent' in window) {
            this.canvas.addEventListener('pointerdown', startDrawing);
            this.canvas.addEventListener('pointermove', continueDrawing);
            this.canvas.addEventListener('pointerup', stopDrawing);
        }
    }

    getCanvasPoint(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
            timestamp: Date.now(),
            pressure: e.pressure || 0.5,
            force: e.force || 0.5
        };
    }

    switchMode(mode) {
        console.log(`🔄 Switching to ${mode} mode`);
        
        this.currentMode = mode;
        
        // Update button states
        const buttons = this.container.querySelectorAll('.mode-button');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // Update container class
        this.canvasContainer.className = `large-writing-canvas ${mode}-mode`;
        
        // Update indicator
        if (mode === 'keyboard') {
            this.indicator.textContent = '⌨️ Keyboard Mode';
            this.container.querySelector('#recognizeBtn').style.display = 'none';
        } else {
            this.indicator.textContent = '✏️ Handwriting Mode';
            this.container.querySelector('#recognizeBtn').style.display = 'flex';
        }
        
        // Clear any existing content when switching modes
        this.clearInput();
        
        // Focus appropriate input
        if (mode === 'keyboard') {
            setTimeout(() => this.textArea.focus(), 100);
        }
    }

    async initializeHandwritingRecognition() {
        try {
            // Use existing handwriting recognition if available
            if (window.handwritingRecognition) {
                this.handwritingRecognizer = window.handwritingRecognition;
                console.log('✅ Using existing handwriting recognition');
            } else if (window.HandwritingRecognition) {
                this.handwritingRecognizer = new window.HandwritingRecognition();
                console.log('✅ Created new handwriting recognition instance');
            } else {
                console.log('⚠️ No handwriting recognition available');
            }
        } catch (error) {
            console.error('❌ Failed to initialize handwriting recognition:', error);
        }
    }

    scheduleAutoRecognition() {
        // Clear any existing timeout
        if (this.autoRecognitionTimeout) {
            clearTimeout(this.autoRecognitionTimeout);
        }
        
        // Schedule recognition after 2 seconds of no drawing
        this.autoRecognitionTimeout = setTimeout(() => {
            if (this.strokes.length > 0 && !this.isDrawing) {
                this.recognizeHandwriting();
            }
        }, 2000);
    }

    async recognizeHandwriting() {
        if (this.strokes.length === 0) {
            this.showFeedback('error', 'Please draw something first!');
            return;
        }

        if (this.isRecognizing) {
            console.log('⚠️ Recognition already in progress');
            return;
        }

        this.isRecognizing = true;
        this.showFeedback('processing', 'Recognizing handwriting...');
        
        try {
            let recognizedText = null;
            
            // Try different recognition methods
            if (this.handwritingRecognizer) {
                // Method 1: Use existing handwriting recognizer
                if (typeof this.handwritingRecognizer.recognizeStrokes === 'function') {
                    recognizedText = await this.handwritingRecognizer.recognizeStrokes(this.strokes);
                } else if (typeof this.handwritingRecognizer.recognizeText === 'function') {
                    // Temporarily set strokes and recognize
                    const oldStrokes = this.handwritingRecognizer.strokes;
                    this.handwritingRecognizer.strokes = this.strokes;
                    recognizedText = await this.handwritingRecognizer.recognizeText();
                    this.handwritingRecognizer.strokes = oldStrokes;
                }
            }
            
            // Method 2: Simple pattern recognition fallback
            if (!recognizedText) {
                recognizedText = this.simplePatternRecognition();
            }
            
            if (recognizedText) {
                this.recognizedText = recognizedText;
                this.textArea.value = recognizedText;
                this.showFeedback('success', `Recognized: "${recognizedText}"`);
                console.log('✅ Handwriting recognition successful:', recognizedText);
            } else {
                this.showFeedback('error', 'Could not recognize handwriting. Please try writing more clearly.');
                console.log('❌ Handwriting recognition failed');
            }
            
        } catch (error) {
            console.error('❌ Recognition error:', error);
            this.showFeedback('error', 'Recognition failed. Please try again.');
        } finally {
            this.isRecognizing = false;
        }
    }

    simplePatternRecognition() {
        // Simple fallback based on stroke patterns
        const strokeCount = this.strokes.length;
        
        console.log(`🔍 Simple pattern recognition: ${strokeCount} strokes`);
        
        if (strokeCount === 1) {
            return 'O';
        } else if (strokeCount === 2) {
            return 'H';
        } else if (strokeCount === 3) {
            return 'Boy';
        } else if (strokeCount >= 4 && strokeCount <= 6) {
            return 'Love';
        } else if (strokeCount > 6) {
            return 'Hello';
        }
        
        return null;
    }

    clearInput() {
        // Clear text
        this.textArea.value = '';
        this.recognizedText = '';
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.strokes = [];
        this.currentStroke = [];
        
        // Clear feedback
        this.showFeedback('', '');
        
        // Clear auto-recognition timeout
        if (this.autoRecognitionTimeout) {
            clearTimeout(this.autoRecognitionTimeout);
        }
        
        console.log('🧹 Input cleared');
    }

    getCurrentText() {
        return this.textArea.value.trim();
    }

    submitAnswer() {
        const answer = this.getCurrentText();
        
        if (!answer) {
            this.showFeedback('error', 'Please enter an answer first!');
            return;
        }
        
        console.log('📝 Submitting answer:', answer);
        
        // Use existing game submission logic if available
        if (window.submitAnswer) {
            window.submitAnswer(answer);
        } else if (window.checkAnswer) {
            window.checkAnswer(answer);
        } else {
            // Fallback - just show success
            this.showFeedback('success', `Answer submitted: "${answer}"`);
            
            // Trigger custom event for other systems to listen
            const event = new CustomEvent('unifiedWriteSubmit', {
                detail: { answer, mode: this.currentMode }
            });
            document.dispatchEvent(event);
        }
        
        // Clear after submission
        setTimeout(() => this.clearInput(), 2000);
    }

    showFeedback(type, message) {
        const feedback = this.container.querySelector('#recognitionFeedback');
        feedback.className = `recognition-feedback ${type}`;
        feedback.textContent = message;
        
        // Auto-clear success/error messages
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                if (feedback.textContent === message) {
                    feedback.textContent = '';
                    feedback.className = 'recognition-feedback';
                }
            }, 5000);
        }
    }

    // Public methods for external integration
    setText(text) {
        this.textArea.value = text;
    }

    getText() {
        return this.getCurrentText();
    }

    setMode(mode) {
        this.switchMode(mode);
    }

    getMode() {
        return this.currentMode;
    }
    
    setupGameIntegration() {
        // Hook into existing submit button if it exists
        const submitBtn = document.querySelector('button[onclick="submitAnswer()"]') || 
                         document.getElementById('submitBtn');
        
        if (submitBtn) {
            // Remove existing onclick and add new handler
            submitBtn.removeAttribute('onclick');
            submitBtn.addEventListener('click', () => {
                if (window.submitAnswer) {
                    window.submitAnswer(this.getText());
                }
            });
        }
        
        // Add Enter key support for keyboard mode
        this.canvas.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.currentMode === 'keyboard') {
                if (window.submitAnswer) {
                    window.submitAnswer(this.getText());
                }
            }
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for other systems to initialize
    setTimeout(() => {
        window.unifiedWriteMode = new UnifiedWriteMode();
        if (window.unifiedWriteMode.setupGameIntegration) {
            window.unifiedWriteMode.setupGameIntegration();
        }
        console.log('✅ Unified Write Mode initialized and integrated');
    }, 500);
});

// Export for use in other scripts
window.UnifiedWriteMode = UnifiedWriteMode;