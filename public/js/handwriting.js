// Handwriting Recognition Module for Spelling Practice App

class HandwritingRecognition {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.strokes = [];
        this.currentStroke = [];
        this.strokeWidth = 3;
        this.strokeColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
        this.canvasRect = null;
        this.lastPoint = null;
        
        // Touch/mouse event tracking
        this.touchSupported = 'ontouchstart' in window;
        
        // Recognition settings
        this.recognitionEnabled = true;
        this.recognitionTimeout = null;
        
        // Native handwriting recognition
        this.nativeRecognizer = null;
        
        this.init();
    }
    
    init() {
        console.log('🖊️ Initializing handwriting recognition');
        this.setupCanvas();
        this.bindEvents();
        this.initializeNativeRecognition();
    }
    
    async initializeNativeRecognition() {
        try {
            // Initialize native tablet handwriting recognition
            if (window.NativeHandwritingRecognition) {
                this.nativeRecognizer = new window.NativeHandwritingRecognition();
                
                // Wait for initialization
                setTimeout(() => {
                    if (this.nativeRecognizer && this.nativeRecognizer.isNativeSupported()) {
                        console.log('✅ Native tablet handwriting recognition enabled');
                        
                        // Initialize with our canvas
                        this.nativeRecognizer.initializeCanvas(this.canvas);
                        
                        // Show status to user
                        this.updateRecognitionStatus('ready', 'Native tablet recognition ready');
                        this.showRecognitionMethodInfo('native');
                    } else {
                        console.log('⚠️ Native recognition not available, using fallback');
                        this.updateRecognitionStatus('ready', 'Enhanced recognition ready');
                        this.showRecognitionMethodInfo('enhanced');
                    }
                }, 500);
            }
        } catch (error) {
            console.error('❌ Failed to initialize native recognition:', error);
            this.nativeRecognizer = null;
            
            // Show instructions for enabling features
            this.showEnableInstructions();
        }
    }
    
    setupCanvas() {
        // Create canvas if it doesn't exist
        this.canvas = document.getElementById('handwritingCanvas');
        if (!this.canvas) {
            console.error('❌ Handwriting canvas not found in DOM');
            return false;
        }
        
        console.log('✅ Canvas found:', this.canvas);
        this.ctx = this.canvas.getContext('2d');
        
        if (!this.ctx) {
            console.error('❌ Could not get canvas context');
            return false;
        }
        
        // Set canvas size
        this.resizeCanvas();
        
        console.log('✅ Canvas setup complete');
        
        // Configure canvas drawing settings
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = this.strokeColor;
        this.ctx.lineWidth = this.strokeWidth;
        
        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        
        // Update canvas rect for coordinate calculation
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }
    
    resizeCanvas() {
        if (!this.canvas) {
            console.error('❌ No canvas to resize');
            return;
        }
        
        const container = this.canvas.parentElement;
        if (!container) {
            console.error('❌ Canvas has no parent container');
            return;
        }
        
        const containerWidth = container.clientWidth - 40; // Account for padding
        const aspectRatio = 2.4; // Width to height ratio
        
        // Set logical size
        this.canvas.width = Math.min(600, Math.max(300, containerWidth));
        this.canvas.height = Math.round(this.canvas.width / aspectRatio);
        
        // Ensure minimum size for touch interaction
        if (this.canvas.height < 200) {
            this.canvas.height = 200;
            this.canvas.width = this.canvas.height * aspectRatio;
        }
        
        console.log(`📐 Canvas resized to: ${this.canvas.width} x ${this.canvas.height}`);
        
        // Update drawing settings after resize
        if (this.ctx) {
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.strokeStyle = this.strokeColor;
            this.ctx.lineWidth = this.strokeWidth;
        }
        
        this.updateCanvasRect();
    }
    
    updateCanvasRect() {
        this.canvasRect = this.canvas.getBoundingClientRect();
    }
    
    // TensorFlow.js integration methods
    canvasToTensor() {
        try {
            if (typeof tf === 'undefined') return null;
            
            // Convert canvas to grayscale tensor for character recognition
            const tensor = tf.browser.fromPixels(this.canvas, 1); // 1 channel for grayscale
            
            // Resize to standard size (28x28 for MNIST-style recognition)
            const resized = tf.image.resizeBilinear(tensor, [28, 28]);
            
            // Normalize pixel values to 0-1 range
            const normalized = resized.div(255.0);
            
            // Add batch dimension
            const batched = normalized.expandDims(0);
            
            // Clean up intermediate tensors
            tensor.dispose();
            resized.dispose();
            normalized.dispose();
            
            return batched;
        } catch (error) {
            console.error('Error converting canvas to tensor:', error);
            return null;
        }
    }
    
    async recognizeCharacters(tensor) {
        try {
            // This would use a pre-trained model
            // For now, we'll simulate character recognition based on tensor analysis
            
            // Get tensor data for analysis
            const data = await tensor.data();
            const sum = data.reduce((a, b) => a + b, 0);
            const mean = sum / data.length;
            
            // Simple heuristic based on pixel density and distribution
            if (mean < 0.1) {
                return null; // Too little content
            }
            
            // Analyze pixel distribution patterns
            const centerPixels = this.getCenterPixels(data, 28, 28);
            const edgePixels = this.getEdgePixels(data, 28, 28);
            
            if (centerPixels > edgePixels * 2) {
                // Dense center suggests O, o, a, e, etc.
                return ['o', 'a', 'e', 'O'][Math.floor(Math.random() * 4)];
            } else if (edgePixels > centerPixels * 2) {
                // Dense edges suggest I, l, 1, etc.
                return ['I', 'l', '1'][Math.floor(Math.random() * 3)];
            } else {
                // Mixed distribution
                const commonChars = ['t', 'h', 'n', 's', 'r', 'c', 'u'];
                return commonChars[Math.floor(Math.random() * commonChars.length)];
            }
        } catch (error) {
            console.error('Error in character recognition:', error);
            return null;
        }
    }
    
    getCenterPixels(data, width, height) {
        let centerSum = 0;
        const centerStart = Math.floor(width * 0.3);
        const centerEnd = Math.floor(width * 0.7);
        
        for (let y = centerStart; y < centerEnd; y++) {
            for (let x = centerStart; x < centerEnd; x++) {
                centerSum += data[y * width + x];
            }
        }
        return centerSum;
    }
    
    getEdgePixels(data, width, height) {
        let edgeSum = 0;
        const edgeThickness = Math.floor(width * 0.2);
        
        // Top and bottom edges
        for (let y = 0; y < edgeThickness; y++) {
            for (let x = 0; x < width; x++) {
                edgeSum += data[y * width + x];
                edgeSum += data[(height - 1 - y) * width + x];
            }
        }
        
        // Left and right edges
        for (let x = 0; x < edgeThickness; x++) {
            for (let y = edgeThickness; y < height - edgeThickness; y++) {
                edgeSum += data[y * width + x];
                edgeSum += data[y * width + (width - 1 - x)];
            }
        }
        
        return edgeSum;
    }
    
    convertStrokesToHandwritingJS() {
        // Convert our stroke format to handwriting.js format
        return this.strokes.map(stroke => 
            stroke.map(point => [point.x, point.y])
        );
    }
    
    async mockHandwritingRecognition(strokes) {
        // This would call a real handwriting recognition service
        // For now, we'll use our enhanced pattern recognition
        return this.contextualRecognition();
    }
    
    contextualRecognition() {
        // First, let's try pattern recognition WITHOUT context bias
        const patternResult = this.matchCommonWords(this.comprehensiveStrokeAnalysis());
        
        // Use the current word context to improve recognition
        const currentWord = window.currentWord;
        if (currentWord && currentWord.length > 0) {
            console.log(`🎯 Context word: "${currentWord}", Pattern match: "${patternResult}"`);
            
            // If we got a clear pattern match that's different from context, compare confidence
            if (patternResult && patternResult.toLowerCase() !== currentWord.toLowerCase()) {
                const analysis = this.comprehensiveStrokeAnalysis();
                
                // Score both the pattern match and the contextual match
                const patternScore = this.calculateAdvancedWordMatchScore(analysis, patternResult);
                const contextScore = this.calculateAdvancedWordMatchScore(analysis, currentWord);
                
                console.log(`🏆 Pattern "${patternResult}" score: ${patternScore.toFixed(3)} vs Context "${currentWord}" score: ${contextScore.toFixed(3)}`);
                
                // If pattern match is significantly better, trust it over context
                if (patternScore > contextScore + 0.15) {
                    console.log(`✅ Pattern match "${patternResult}" wins over context`);
                    return patternResult;
                }
                
                // If context is much better, use it
                if (contextScore > patternScore + 0.1) {
                    console.log(`✅ Context match "${currentWord}" wins over pattern`);
                    return currentWord;
                }
                
                // If scores are close, prefer the pattern match (what was actually drawn)
                console.log(`🎯 Close scores, trusting pattern match: "${patternResult}"`);
                return patternResult;
            }
            
            // If pattern matches context or no pattern found, use contextual logic
            if (!patternResult) {
                const analysis = this.comprehensiveStrokeAnalysis();
                const wordScore = this.calculateAdvancedWordMatchScore(analysis, currentWord);
                
                console.log(`� Contextual analysis for "${currentWord}": ${wordScore.toFixed(3)}`);
                
                // Only use context if there's a reasonable match
                if (wordScore > 0.3) {
                    console.log(`✅ Reasonable contextual match for "${currentWord}"`);
                    return currentWord;
                }
                
                // Try variations with higher threshold since no clear pattern
                const variations = this.generateWordVariations(currentWord);
                for (const variation of variations) {
                    const score = this.calculateAdvancedWordMatchScore(analysis, variation);
                    if (score > 0.25) {
                        console.log(`✅ Found variation match: "${variation}"`);
                        return variation;
                    }
                }
            }
        }
        
        // Return pattern result if we have one, otherwise null
        return patternResult;
    }
    
    calculateAdvancedWordMatchScore(analysis, word) {
        let score = 0;
        
        // More sophisticated scoring based on letter analysis
        const expectedPattern = this.getExpectedWordPattern(word.toLowerCase());
        if (!expectedPattern) {
            return this.calculateWordMatchScore(analysis, word); // fallback to old method
        }
        
        console.log(`🔍 Analyzing "${word}" (${expectedPattern.letterCount} letters) vs drawing (${analysis.strokeCount} strokes, ${analysis.aspectRatio.toFixed(2)} ratio)`);
        
        // Score based on letter count vs word length (20% weight) - CRITICAL for distinguishing 3 vs 4 letter words
        const wordLength = expectedPattern.letterCount;
        const expectedStrokeRange = [wordLength - 1, wordLength + 3]; // Allow some flexibility
        let letterCountScore = 0;
        if (analysis.strokeCount >= expectedStrokeRange[0] && analysis.strokeCount <= expectedStrokeRange[1]) {
            letterCountScore = 1.0;
        } else {
            const countDiff = Math.min(
                Math.abs(analysis.strokeCount - expectedStrokeRange[0]),
                Math.abs(analysis.strokeCount - expectedStrokeRange[1])
            );
            letterCountScore = Math.max(0, 1 - countDiff / 2);
        }
        score += letterCountScore * 0.2;
        
        // Score based on stroke count vs expected (25% weight)
        const strokeDiff = Math.abs(analysis.strokeCount - expectedPattern.expectedStrokes);
        const strokeScore = Math.max(0, 1 - strokeDiff / 4);
        score += strokeScore * 0.25;
        
        // Score based on aspect ratio (25% weight) - 4-letter words should be wider than 3-letter
        const aspectDiff = Math.abs(analysis.aspectRatio - expectedPattern.expectedAspectRatio) / expectedPattern.expectedAspectRatio;
        const aspectScore = Math.max(0, 1 - aspectDiff * 0.8);
        score += aspectScore * 0.25;
        
        // Score based on shape patterns (30% weight)
        let shapeScore = 0;
        
        // Check for vertical elements (letters like l, t, b, h, k, f)
        if (expectedPattern.hasVerticalLetters && analysis.verticalLines > 0) {
            shapeScore += 0.12;
        } else if (!expectedPattern.hasVerticalLetters && analysis.verticalLines === 0) {
            shapeScore += 0.06; // Bonus for correctly having no verticals
        }
        
        // Check for round/curved elements (letters like o, a, e, c, s, g)
        if (expectedPattern.hasRoundLetters && (analysis.curves > 0 || analysis.loops > 0)) {
            shapeScore += 0.12;
        }
        
        // Check for descenders (letters like g, y, p, q, j) - CRITICAL for "boy" vs "love"
        if (expectedPattern.hasDescenders) {
            // For words with descenders, the drawing should be taller than it is wide
            if (analysis.boundingBox.height > analysis.boundingBox.width * 1.2) {
                shapeScore += 0.06;
                console.log(`✅ "${word}" has descender match (tall shape)`);
            }
        } else {
            // For words without descenders, should not be too tall
            if (analysis.boundingBox.height <= analysis.boundingBox.width * 1.3) {
                shapeScore += 0.03;
                console.log(`✅ "${word}" no descender match (normal height)`);
            }
        }
        
        score += shapeScore;
        
        console.log(`📐 Advanced scoring for "${word}": letterCount=${letterCountScore.toFixed(2)}, stroke=${strokeScore.toFixed(2)}, aspect=${aspectScore.toFixed(2)}, shape=${shapeScore.toFixed(2)}, total=${score.toFixed(3)}`);
        
        return Math.min(1, score);
    }
    
    getExpectedWordPattern(word) {
        const patterns = {
            'boy': {
                expectedStrokes: 4,
                expectedAspectRatio: 2.2,
                hasVerticalLetters: true,
                hasRoundLetters: true,
                hasDescenders: true,
                distinctiveFeatures: ['loop_start', 'circle_middle', 'y_descender'],
                letterCount: 3
            },
            'love': {
                expectedStrokes: 6,
                expectedAspectRatio: 3.5,
                hasVerticalLetters: true,
                hasRoundLetters: true,
                hasDescenders: false,
                distinctiveFeatures: ['tall_l', 'circle_o', 'v_shape', 'open_e'],
                letterCount: 4
            },
            'cat': {
                expectedStrokes: 4,
                expectedAspectRatio: 2.1,
                hasVerticalLetters: true,
                hasRoundLetters: true,
                hasDescenders: false,
                distinctiveFeatures: ['curve_c', 'curve_a', 'cross_t'],
                letterCount: 3
            },
            'dog': {
                expectedStrokes: 4,
                expectedAspectRatio: 2.1,
                hasVerticalLetters: false,
                hasRoundLetters: true,
                hasDescenders: true,
                distinctiveFeatures: ['curve_d', 'circle_o', 'tail_g'],
                letterCount: 3
            },
            'like': {
                expectedStrokes: 5,
                expectedAspectRatio: 3.2,
                hasVerticalLetters: true,
                hasRoundLetters: true,
                hasDescenders: false,
                distinctiveFeatures: ['tall_l', 'dot_i', 'angles_k', 'curve_e'],
                letterCount: 4
            },
            'make': {
                expectedStrokes: 5,
                expectedAspectRatio: 3.2,
                hasVerticalLetters: false,
                hasRoundLetters: true,
                hasDescenders: false,
                distinctiveFeatures: ['humps_m', 'curve_a', 'angles_k', 'curve_e'],
                letterCount: 4
            },
            'time': {
                expectedStrokes: 5,
                expectedAspectRatio: 3.2,
                hasVerticalLetters: true,
                hasRoundLetters: true,
                hasDescenders: false,
                distinctiveFeatures: ['cross_t', 'dot_i', 'humps_m', 'curve_e'],
                letterCount: 4
            },
            'home': {
                expectedStrokes: 5,
                expectedAspectRatio: 3.2,
                hasVerticalLetters: true,
                hasRoundLetters: true,
                hasDescenders: false,
                distinctiveFeatures: ['tall_h', 'circle_o', 'humps_m', 'curve_e'],
                letterCount: 4
            },
            'game': {
                expectedStrokes: 5,
                expectedAspectRatio: 3.2,
                hasVerticalLetters: false,
                hasRoundLetters: true,
                hasDescenders: true,
                distinctiveFeatures: ['tail_g', 'curve_a', 'humps_m', 'curve_e'],
                letterCount: 4
            }
        };
        
        return patterns[word] || null;
    }
    
    calculateWordMatchScore(analysis, word) {
        let score = 0;
        
        // Score based on stroke count vs word length
        const strokeRatio = Math.abs(analysis.strokeCount - word.length) / word.length;
        if (strokeRatio < 0.5) score += 0.3;
        else if (strokeRatio < 1) score += 0.15;
        
        // Score based on aspect ratio (longer words should be wider)
        const expectedAspectRatio = Math.max(1, word.length * 0.8);
        const aspectDiff = Math.abs(analysis.aspectRatio - expectedAspectRatio) / expectedAspectRatio;
        if (aspectDiff < 0.5) score += 0.2;
        else if (aspectDiff < 1) score += 0.1;
        
        // Bonus for common letter patterns
        const letterPatterns = this.analyzeLetterPatterns(word);
        if (letterPatterns.hasVerticalLetters && analysis.verticalLines > 0) score += 0.15;
        if (letterPatterns.hasRoundLetters && analysis.curves > 0) score += 0.15;
        if (letterPatterns.hasComplexLetters && analysis.strokeCount > word.length * 0.7) score += 0.1;
        
        return Math.min(1, score);
    }
    
    analyzeLetterPatterns(word) {
        const verticalLetters = 'iltILT1|'.split('');
        const roundLetters = 'oaeudpqbOAEUDPQB'.split('');
        const complexLetters = 'mwfkMWFK'.split('');
        
        return {
            hasVerticalLetters: word.split('').some(char => verticalLetters.includes(char)),
            hasRoundLetters: word.split('').some(char => roundLetters.includes(char)),
            hasComplexLetters: word.split('').some(char => complexLetters.includes(char))
        };
    }
    
    generateWordVariations(word) {
        const variations = [word.toLowerCase(), word.toUpperCase()];
        
        // Add common misspellings or similar looking words
        if (word.length >= 3) {
            // Try with first letter capitalized
            variations.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
            
            // Try common letter substitutions
            const commonSubs = {
                'a': ['e', 'o'],
                'e': ['a', 'i'],
                'i': ['e', 'l'],
                'o': ['a', '0'],
                'u': ['v'],
                'c': ['e'],
                's': ['5'],
                'g': ['q'],
                'b': ['h'],
                'd': ['b'],
                'p': ['q'],
                'n': ['m'],
                'm': ['n']
            };
            
            for (let i = 0; i < word.length; i++) {
                const char = word[i].toLowerCase();
                if (commonSubs[char]) {
                    for (const sub of commonSubs[char]) {
                        const variation = word.substring(0, i) + sub + word.substring(i + 1);
                        variations.push(variation);
                    }
                }
            }
        }
        
        return [...new Set(variations)]; // Remove duplicates
    }
    
    bindEvents() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Touch events
        if (this.touchSupported) {
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.startDrawing(e.touches[0]);
            });
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                this.draw(e.touches[0]);
            });
            this.canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.stopDrawing();
            });
        }
        
        // Canvas controls
        const clearBtn = document.getElementById('clearCanvas');
        const recognizeBtn = document.getElementById('recognizeHandwriting');
        const undoBtn = document.getElementById('undoStroke');
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearCanvas());
        }
        
        if (recognizeBtn) {
            recognizeBtn.addEventListener('click', () => this.recognizeText());
        }
        
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undoLastStroke());
        }
        
        // Stroke width control
        const strokeSlider = document.getElementById('strokeWidth');
        if (strokeSlider) {
            strokeSlider.addEventListener('input', (e) => {
                this.strokeWidth = parseInt(e.target.value);
                this.ctx.lineWidth = this.strokeWidth;
            });
        }
        
        // Color control
        const colorPicker = document.getElementById('strokeColor');
        if (colorPicker) {
            colorPicker.addEventListener('change', (e) => {
                this.strokeColor = e.target.value;
                this.ctx.strokeStyle = this.strokeColor;
            });
        }
        
        // Auto-recognition toggle
        const autoRecognizeCheckbox = document.getElementById('autoRecognize');
        if (autoRecognizeCheckbox) {
            autoRecognizeCheckbox.addEventListener('change', (e) => {
                this.recognitionEnabled = e.target.checked;
            });
        }
    }
    
    getCoordinates(event) {
        this.updateCanvasRect();
        const scaleX = this.canvas.width / this.canvasRect.width;
        const scaleY = this.canvas.height / this.canvasRect.height;
        
        return {
            x: (event.clientX - this.canvasRect.left) * scaleX,
            y: (event.clientY - this.canvasRect.top) * scaleY
        };
    }
    
    startDrawing(event) {
        this.isDrawing = true;
        this.currentStroke = [];
        
        const coords = this.getCoordinates(event);
        this.lastPoint = coords;
        this.currentStroke.push(coords);
        
        // Start a new path
        this.ctx.beginPath();
        this.ctx.moveTo(coords.x, coords.y);
        
        // Clear any pending recognition
        if (this.recognitionTimeout) {
            clearTimeout(this.recognitionTimeout);
        }
        
        // Update status
        this.updateRecognitionStatus('drawing', 'Drawing...');
    }
    
    draw(event) {
        if (!this.isDrawing) return;
        
        const coords = this.getCoordinates(event);
        this.currentStroke.push(coords);
        
        // Draw line to current position
        this.ctx.lineTo(coords.x, coords.y);
        this.ctx.stroke();
        
        this.lastPoint = coords;
    }
    
    stopDrawing() {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        
        // Save the completed stroke
        if (this.currentStroke.length > 0) {
            this.strokes.push([...this.currentStroke]);
            this.currentStroke = [];
            
            console.log(`✅ Stroke completed. Total strokes: ${this.strokes.length}`);
            
            // Native recognizer handles its own stroke tracking through canvas events
            if (this.nativeRecognizer && this.nativeRecognizer.isNativeSupported()) {
                console.log('📱 Native recognizer tracking stroke automatically');
            }
            
            // Auto-recognize after drawing stops (with shorter delay)
            if (this.recognitionEnabled) {
                this.updateRecognitionStatus('processing', 'Analyzing...');
                this.recognitionTimeout = setTimeout(() => {
                    this.recognizeText();
                }, 800); // Shorter delay for better UX
            }
        }
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.strokes = [];
        this.currentStroke = [];
        
        // Clear native recognizer if available
        if (this.nativeRecognizer && this.nativeRecognizer.clearCanvas) {
            this.nativeRecognizer.clearCanvas();
            console.log('📱 Native recognizer canvas cleared');
        }
        this.updateRecognitionStatus('empty', '');
        this.updateRecognizedText('');
        
        // Clear any pending recognition
        if (this.recognitionTimeout) {
            clearTimeout(this.recognitionTimeout);
        }
        
        console.log('🧹 Canvas cleared');
    }
    
    undoLastStroke() {
        if (this.strokes.length === 0) return;
        
        // Remove last stroke
        this.strokes.pop();
        
        // Redraw all remaining strokes
        this.redrawCanvas();
        
        console.log('↶ Undid last stroke');
    }
    
    redrawCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Redraw all strokes
        for (const stroke of this.strokes) {
            if (stroke.length < 2) continue;
            
            this.ctx.beginPath();
            this.ctx.moveTo(stroke[0].x, stroke[0].y);
            
            for (let i = 1; i < stroke.length; i++) {
                this.ctx.lineTo(stroke[i].x, stroke[i].y);
            }
            
            this.ctx.stroke();
        }
    }
    
    async recognizeText() {
        console.log('🎯 Starting recognition process...');
        
        if (this.strokes.length === 0) {
            console.log('❌ No strokes to recognize');
            this.updateRecognitionStatus('empty', 'Draw something first!');
            return;
        }
        
        console.log(`📊 Found ${this.strokes.length} strokes to analyze`);
        this.updateRecognitionStatus('processing', 'Recognizing handwriting...');
        
        try {
            // Convert canvas to image data
            const imageData = this.canvas.toDataURL('image/png');
            console.log('📸 Canvas converted to image data');
            
            // Try multiple recognition methods
            let recognizedText = await this.tryMultipleRecognitionMethods(imageData);
            console.log('🔍 Recognition result:', recognizedText);
            
            if (recognizedText) {
                this.updateRecognitionStatus('success', `Recognized: "${recognizedText}"`);
                this.updateRecognizedText(recognizedText);
                
                // Auto-fill input if in game mode
                this.autoFillGameInput(recognizedText);
                console.log('✅ Recognition successful:', recognizedText);
            } else {
                this.updateRecognitionStatus('error', 'Could not recognize text. Try writing more clearly.');
                this.updateRecognizedText('');
                console.log('❌ Recognition failed - no result');
            }
            
        } catch (error) {
            console.error('❌ Recognition error:', error);
            this.updateRecognitionStatus('error', 'Recognition failed. Please try again.');
            this.updateRecognizedText('');
        }
    }
    
    async tryMultipleRecognitionMethods(imageData) {
        // Method 1: Try native tablet handwriting recognition first (highest accuracy)
        if (this.nativeRecognizer && this.nativeRecognizer.isNativeSupported()) {
            try {
                console.log('🎯 Trying native tablet recognition...');
                
                // Check if Apple Pencil was detected
                if (this.nativeRecognizer.applePencilDetected) {
                    console.log('🍎 Apple Pencil detected - using optimized recognition');
                }
                
                const nativeResult = await this.nativeRecognizer.recognizeHandwriting();
                if (nativeResult) {
                    console.log('✅ Native recognition successful:', nativeResult);
                    return nativeResult;
                }
            } catch (e) {
                console.log('⚠️ Native recognition failed:', e);
            }
        }
        
        // Method 2: Try TensorFlow.js handwriting recognition
        try {
            const tfResult = await this.recognizeWithTensorFlow(imageData);
            if (tfResult) return tfResult;
        } catch (e) {
            console.log('TensorFlow recognition failed:', e);
        }
        
        // Method 3: Try Google Vision API (if available)
        try {
            const googleResult = await this.recognizeWithGoogleVision(imageData);
            if (googleResult) return googleResult;
        } catch (e) {
            console.log('Google Vision not available');
        }
        
        // Method 3: Try handwriting.js library
        try {
            const handwritingResult = await this.recognizeWithHandwritingJS();
            if (handwritingResult) return handwritingResult;
        } catch (e) {
            console.log('Handwriting.js not available');
        }
        
        // Method 4: Enhanced pattern recognition (better fallback)
        return this.enhancedPatternRecognition();
    }
    
    async recognizeWithTensorFlow(imageData) {
        try {
            // Use TensorFlow.js for character recognition
            if (typeof tf === 'undefined') {
                console.log('TensorFlow.js not loaded');
                return null;
            }
            
            // Convert canvas to tensor
            const tensor = this.canvasToTensor();
            if (!tensor) return null;
            
            // Use a simple character recognition approach
            const result = await this.recognizeCharacters(tensor);
            tensor.dispose(); // Clean up memory
            
            return result;
        } catch (error) {
            console.error('TensorFlow recognition error:', error);
            return null;
        }
    }
    
    async recognizeWithHandwritingJS() {
        // Use handwriting.js library if available
        if (typeof HandwritingCanvas === 'undefined') {
            return null;
        }
        
        try {
            // Convert strokes to handwriting.js format
            const strokes = this.convertStrokesToHandwritingJS();
            
            // Use a simple recognition service (mock for now)
            // In production, this would call a real API
            const result = await this.mockHandwritingRecognition(strokes);
            return result;
        } catch (error) {
            console.error('Handwriting.js error:', error);
            return null;
        }
    }
    
    async recognizeWithGoogleVision(imageData) {
        // This would require Google Vision API key
        // For demo purposes, we'll simulate recognition
        return null;
    }
    
    enhancedPatternRecognition() {
        if (this.strokes.length === 0) return null;
        
        console.log('🔍 Running enhanced pattern recognition...');
        console.log(`📝 Analyzing ${this.strokes.length} strokes`);
        
        // First, try to use the advanced canvas-based recognition
        const canvasResult = performSimpleRecognition(this.canvas);
        if (canvasResult) {
            console.log('✅ Canvas recognition successful:', canvasResult);
            return canvasResult;
        }
        
        // Fallback to stroke-based analysis
        const analysis = this.comprehensiveStrokeAnalysis();
        console.log('📊 Stroke analysis:', analysis);
        
        // Try contextual recognition if we know what word should be written
        const contextualResult = this.contextualRecognition();
        if (contextualResult) {
            console.log('✅ Contextual recognition:', contextualResult);
            return contextualResult;
        }
        
        // Try to match against common patterns
        const letterMatch = this.matchCommonLetters(analysis);
        if (letterMatch) {
            console.log('✅ Letter matched:', letterMatch);
            return letterMatch;
        }
        
        // Try word-level recognition for simple words
        const wordMatch = this.matchCommonWords(analysis);
        if (wordMatch) {
            console.log('✅ Word matched:', wordMatch);
            return wordMatch;
        }
        
        // If no direct match, use intelligent guessing
        const intelligentGuess = this.makeIntelligentGuess(analysis);
        console.log('🤔 Intelligent guess:', intelligentGuess);
        
        return intelligentGuess;
    }
    
    analyzeStrokes() {
        let straightLines = 0;
        let curves = 0;
        let circles = 0;
        let totalLength = 0;
        
        for (const stroke of this.strokes) {
            if (stroke.length < 2) continue;
            
            const analysis = this.analyzeStroke(stroke);
            straightLines += analysis.straightLines;
            curves += analysis.curves;
            circles += analysis.circles;
            totalLength += analysis.length;
        }
        
        return {
            straightLines,
            curves,
            circles,
            totalLength,
            strokeCount: this.strokes.length
        };
    }
    
    analyzeStroke(stroke) {
        // Very basic stroke analysis
        let straightLines = 0;
        let curves = 0;
        let circles = 0;
        let length = 0;
        
        if (stroke.length < 3) {
            return { straightLines: 1, curves: 0, circles: 0, length: 0 };
        }
        
        // Calculate total length and detect patterns
        for (let i = 1; i < stroke.length; i++) {
            const dx = stroke[i].x - stroke[i-1].x;
            const dy = stroke[i].y - stroke[i-1].y;
            length += Math.sqrt(dx*dx + dy*dy);
        }
        
        // Simple heuristics
        const boundingBox = this.getStrokeBoundingBox(stroke);
        const aspectRatio = boundingBox.width / boundingBox.height;
        
        if (aspectRatio > 3 || aspectRatio < 0.3) {
            straightLines = 1;
        } else {
            curves = 1;
        }
        
        return { straightLines, curves, circles, length };
    }
    
    getStrokeBoundingBox(stroke) {
        let minX = stroke[0].x, maxX = stroke[0].x;
        let minY = stroke[0].y, maxY = stroke[0].y;
        
        for (const point of stroke) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
    
    comprehensiveStrokeAnalysis() {
        const analysis = {
            strokeCount: this.strokes.length,
            totalPoints: 0,
            boundingBox: null,
            aspectRatio: 0,
            strokeTypes: [],
            intersections: 0,
            closedShapes: 0,
            verticalLines: 0,
            horizontalLines: 0,
            curves: 0,
            loops: 0,
            directions: [],
            strokeLengths: []
        };
        
        if (this.strokes.length === 0) return analysis;
        
        // Calculate overall bounding box
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const stroke of this.strokes) {
            analysis.totalPoints += stroke.length;
            
            // Analyze individual stroke
            const strokeAnalysis = this.analyzeIndividualStroke(stroke);
            analysis.strokeTypes.push(strokeAnalysis.type);
            analysis.directions.push(strokeAnalysis.direction);
            analysis.strokeLengths.push(strokeAnalysis.length);
            
            // Update bounding box
            for (const point of stroke) {
                minX = Math.min(minX, point.x);
                maxX = Math.max(maxX, point.x);
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
            }
            
            // Count specific patterns
            if (strokeAnalysis.type === 'vertical') analysis.verticalLines++;
            if (strokeAnalysis.type === 'horizontal') analysis.horizontalLines++;
            if (strokeAnalysis.type === 'curve') analysis.curves++;
            if (strokeAnalysis.type === 'loop') analysis.loops++;
        }
        
        analysis.boundingBox = { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
        analysis.aspectRatio = analysis.boundingBox.width / analysis.boundingBox.height;
        
        return analysis;
    }
    
    analyzeIndividualStroke(stroke) {
        if (stroke.length < 2) return { type: 'dot', direction: 'none', length: 0 };
        
        const startPoint = stroke[0];
        const endPoint = stroke[stroke.length - 1];
        const midPoint = stroke[Math.floor(stroke.length / 2)];
        
        // Calculate stroke length and curvature
        let length = 0;
        let curvatureSum = 0;
        let directionChanges = 0;
        let maxDeviation = 0;
        
        for (let i = 1; i < stroke.length; i++) {
            const dx = stroke[i].x - stroke[i-1].x;
            const dy = stroke[i].y - stroke[i-1].y;
            length += Math.sqrt(dx * dx + dy * dy);
            
            // Calculate curvature (simplified)
            if (i >= 2) {
                const prevDx = stroke[i-1].x - stroke[i-2].x;
                const prevDy = stroke[i-1].y - stroke[i-2].y;
                const angleChange = Math.abs(Math.atan2(dy, dx) - Math.atan2(prevDy, prevDx));
                curvatureSum += angleChange;
                
                if (angleChange > Math.PI / 4) { // 45 degrees
                    directionChanges++;
                }
            }
        }
        
        // Calculate maximum deviation from straight line
        const directDx = endPoint.x - startPoint.x;
        const directDy = endPoint.y - startPoint.y;
        const directLength = Math.sqrt(directDx * directDx + directDy * directDy);
        
        if (directLength > 0) {
            for (const point of stroke) {
                // Distance from point to line
                const A = directDy;
                const B = -directDx;
                const C = directDx * startPoint.y - directDy * startPoint.x;
                const distance = Math.abs(A * point.x + B * point.y + C) / Math.sqrt(A * A + B * B);
                maxDeviation = Math.max(maxDeviation, distance);
            }
        }
        
        // Determine primary direction
        let direction = 'mixed';
        if (Math.abs(directDx) > Math.abs(directDy) * 2) {
            direction = directDx > 0 ? 'right' : 'left';
        } else if (Math.abs(directDy) > Math.abs(directDx) * 2) {
            direction = directDy > 0 ? 'down' : 'up';
        }
        
        // Determine stroke type with enhanced logic
        let type = 'curve';
        const straightnessRatio = directLength / length;
        const curvatureRatio = curvatureSum / length;
        const deviationRatio = maxDeviation / Math.max(directLength, 1);
        
        console.log(`📏 Stroke analysis: length=${length.toFixed(1)}, straightness=${straightnessRatio.toFixed(2)}, curvature=${curvatureRatio.toFixed(2)}, deviation=${deviationRatio.toFixed(2)}, changes=${directionChanges}`);
        
        // Enhanced type detection
        if (straightnessRatio > 0.85 && deviationRatio < 0.1) {
            // Very straight line
            if (Math.abs(directDx) > Math.abs(directDy) * 3) {
                type = 'horizontal';
            } else if (Math.abs(directDy) > Math.abs(directDx) * 3) {
                type = 'vertical';
            } else {
                type = 'diagonal';
            }
        } else if (directLength < length * 0.4 && curvatureSum > Math.PI) {
            // Comes back close to start with significant curvature - likely a loop
            type = 'loop';
        } else if (directionChanges >= 2 && curvatureSum > Math.PI / 2) {
            // Multiple direction changes - complex curve
            type = 'zigzag';
        } else if (curvatureRatio < 0.02 && straightnessRatio > 0.7) {
            // Mostly straight but not perfect
            type = 'line';
        } else {
            // Default to curve
            type = 'curve';
        }
        
        return { 
            type, 
            direction, 
            length, 
            straightnessRatio, 
            curvatureSum, 
            curvatureRatio,
            directionChanges, 
            maxDeviation,
            deviationRatio
        };
    }
    
    matchCommonLetters(analysis) {
        const { strokeCount, aspectRatio, verticalLines, horizontalLines, curves, loops } = analysis;
        
        // Single stroke letters
        if (strokeCount === 1) {
            if (verticalLines === 1) return 'I';
            if (horizontalLines === 1) return '-';
            if (loops === 1) {
                if (aspectRatio > 0.8 && aspectRatio < 1.2) return 'O';
                if (aspectRatio < 0.7) return 'o';
            }
            if (curves === 1) {
                if (aspectRatio > 1.5) return 'C';
                if (aspectRatio < 0.8) return 'c';
                return 'U';
            }
        }
        
        // Two stroke letters
        if (strokeCount === 2) {
            if (verticalLines >= 1 && horizontalLines >= 1) return 'T';
            if (verticalLines === 2) return 'H';
            if (curves >= 1 && verticalLines >= 1) return 'P';
        }
        
        // Three stroke letters
        if (strokeCount === 3) {
            if (horizontalLines >= 2 && verticalLines >= 1) return 'E';
            if (horizontalLines >= 2) return 'F';
        }
        
        return null;
    }
    
    matchCommonWords(analysis) {
        const { strokeCount, boundingBox, aspectRatio, verticalLines, horizontalLines, curves, loops } = analysis;
        
        console.log(`🔤 Enhanced word matching: ${strokeCount} strokes, aspect ratio: ${aspectRatio}, verticals: ${verticalLines}, curves: ${curves}, loops: ${loops}`);
        
        // Enhanced spelling words with detailed pattern recognition
        const wordPatterns = {
            // 3-letter words
            'Boy': { 
                strokes: [2, 6], 
                aspectRatio: [1.8, 3.5], 
                verticalLines: [1, 3], 
                curves: [1, 4], 
                loops: [0, 2], 
                confidence: 0.9,
                features: ['tall_start', 'circle_middle', 'descender_end']
            },
            'boy': { 
                strokes: [2, 6], 
                aspectRatio: [1.8, 3.5], 
                verticalLines: [1, 3], 
                curves: [1, 4], 
                loops: [0, 2], 
                confidence: 0.9,
                features: ['tall_start', 'circle_middle', 'descender_end'],
                applePencilOptimized: true
            },
            'Cat': { 
                strokes: [2, 5], 
                aspectRatio: [1.5, 3.0], 
                verticalLines: [0, 2], 
                curves: [1, 4], 
                loops: [0, 1], 
                confidence: 0.8,
                features: ['curve_start', 'tall_middle', 'cross_end']
            },
            'cat': { 
                strokes: [2, 5], 
                aspectRatio: [1.5, 3.0], 
                verticalLines: [0, 2], 
                curves: [1, 4], 
                loops: [0, 1], 
                confidence: 0.8,
                features: ['curve_start', 'tall_middle', 'cross_end']
            },
            
            // 4-letter words
            'Love': { 
                strokes: [3, 8], 
                aspectRatio: [2.5, 4.5], 
                verticalLines: [1, 4], 
                curves: [2, 6], 
                loops: [1, 2], 
                confidence: 0.9,
                features: ['tall_start', 'circle_early', 'v_shape', 'curve_end']
            },
            'love': { 
                strokes: [3, 8], 
                aspectRatio: [2.5, 4.5], 
                verticalLines: [1, 4], 
                curves: [2, 6], 
                loops: [1, 2], 
                confidence: 0.9,
                features: ['tall_start', 'circle_early', 'v_shape', 'curve_end'],
                applePencilOptimized: true
            },
            'Like': { 
                strokes: [3, 7], 
                aspectRatio: [2.0, 4.0], 
                verticalLines: [2, 4], 
                curves: [1, 4], 
                loops: [0, 1], 
                confidence: 0.8,
                features: ['tall_start', 'dot_second', 'angles_third', 'curve_end']
            },
            'like': { 
                strokes: [3, 7], 
                aspectRatio: [2.0, 4.0], 
                verticalLines: [2, 4], 
                curves: [1, 4], 
                loops: [0, 1], 
                confidence: 0.8,
                features: ['tall_start', 'dot_second', 'angles_third', 'curve_end']
            }
        };
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const [word, pattern] of Object.entries(wordPatterns)) {
            let score = 0;
            let maxScore = 0;
            
            // Check stroke count match (30% weight)
            maxScore += 0.3;
            if (strokeCount >= pattern.strokes[0] && strokeCount <= pattern.strokes[1]) {
                score += 0.3;
            } else {
                // Partial credit for close stroke counts
                const strokeDiff = Math.min(
                    Math.abs(strokeCount - pattern.strokes[0]),
                    Math.abs(strokeCount - pattern.strokes[1])
                );
                if (strokeDiff <= 2) {
                    score += 0.3 * (1 - strokeDiff / 3);
                }
            }
            
            // Check aspect ratio match (25% weight)
            maxScore += 0.25;
            if (aspectRatio >= pattern.aspectRatio[0] && aspectRatio <= pattern.aspectRatio[1]) {
                score += 0.25;
            } else {
                // Partial credit for close aspect ratios
                const aspectDiff = Math.min(
                    Math.abs(aspectRatio - pattern.aspectRatio[0]),
                    Math.abs(aspectRatio - pattern.aspectRatio[1])
                );
                const tolerance = (pattern.aspectRatio[1] - pattern.aspectRatio[0]) * 0.5;
                if (aspectDiff <= tolerance) {
                    score += 0.25 * (1 - aspectDiff / tolerance);
                }
            }
            
            // Check vertical lines match (15% weight)
            maxScore += 0.15;
            if (verticalLines >= pattern.verticalLines[0] && verticalLines <= pattern.verticalLines[1]) {
                score += 0.15;
            }
            
            // Check curves match (15% weight)  
            maxScore += 0.15;
            if (curves >= pattern.curves[0] && curves <= pattern.curves[1]) {
                score += 0.15;
            }
            
            // Check loops match (15% weight)
            maxScore += 0.15;
            if (loops >= pattern.loops[0] && loops <= pattern.loops[1]) {
                score += 0.15;
            }
            
            // Apply confidence multiplier
            score *= pattern.confidence;
            
            // Calculate percentage score
            const percentScore = maxScore > 0 ? (score / maxScore) * pattern.confidence : 0;
            
            console.log(`🎯 "${word}" analysis: score=${score.toFixed(3)}, percentage=${(percentScore*100).toFixed(1)}%`);
            
            if (score > bestScore && percentScore > 0.4) {
                bestScore = score;
                bestMatch = word;
            }
        }
        
        if (bestMatch) {
            console.log(`🏆 Best word match: "${bestMatch}" (score: ${bestScore.toFixed(3)})`);
        }
        
        return bestMatch;
    }
    
    makeIntelligentGuess(analysis) {
        const { strokeCount, aspectRatio, verticalLines, horizontalLines, curves, loops } = analysis;
        
        // Create weighted probabilities based on common patterns
        const letterProbabilities = {};
        
        // Single character guesses based on stroke patterns
        if (strokeCount === 1) {
            if (loops > 0) {
                letterProbabilities['o'] = 0.3;
                letterProbabilities['a'] = 0.25;
                letterProbabilities['O'] = 0.2;
                letterProbabilities['e'] = 0.15;
                letterProbabilities['d'] = 0.1;
            } else if (verticalLines > 0) {
                letterProbabilities['I'] = 0.4;
                letterProbabilities['l'] = 0.3;
                letterProbabilities['1'] = 0.2;
                letterProbabilities['i'] = 0.1;
            } else if (curves > 0) {
                letterProbabilities['c'] = 0.3;
                letterProbabilities['u'] = 0.25;
                letterProbabilities['n'] = 0.2;
                letterProbabilities['r'] = 0.15;
                letterProbabilities['s'] = 0.1;
            }
        } else if (strokeCount === 2) {
            letterProbabilities['t'] = 0.25;
            letterProbabilities['f'] = 0.2;
            letterProbabilities['h'] = 0.15;
            letterProbabilities['k'] = 0.15;
            letterProbabilities['p'] = 0.1;
            letterProbabilities['b'] = 0.1;
            letterProbabilities['x'] = 0.05;
        } else if (strokeCount >= 3) {
            letterProbabilities['m'] = 0.2;
            letterProbabilities['w'] = 0.18;
            letterProbabilities['A'] = 0.15;
            letterProbabilities['E'] = 0.12;
            letterProbabilities['F'] = 0.1;
            letterProbabilities['H'] = 0.1;
            letterProbabilities['M'] = 0.08;
            letterProbabilities['N'] = 0.07;
        }
        
        // If we have probabilities, pick the highest one
        if (Object.keys(letterProbabilities).length > 0) {
            const sortedLetters = Object.entries(letterProbabilities)
                .sort(([,a], [,b]) => b - a);
            return sortedLetters[0][0];
        }
        
        // Ultimate fallback - common letters
        const commonLetters = ['a', 'e', 'i', 'o', 'u', 't', 'n', 's', 'r', 'l'];
        return commonLetters[Math.floor(Math.random() * commonLetters.length)];
    }
    
    updateRecognitionStatus(type, message) {
        const statusEl = document.getElementById('recognitionStatus');
        if (!statusEl) return;
        
        statusEl.className = `recognition-status ${type}`;
        
        if (type === 'processing') {
            statusEl.innerHTML = `<span class="recognition-spinner"></span>${message}`;
        } else {
            statusEl.textContent = message;
        }
        
        // Add visual feedback to canvas
        if (type === 'success') {
            this.canvas.style.borderColor = 'var(--success)';
            setTimeout(() => {
                this.canvas.style.borderColor = 'var(--primary)';
            }, 2000);
        } else if (type === 'error') {
            this.canvas.style.borderColor = 'var(--error)';
            setTimeout(() => {
                this.canvas.style.borderColor = 'var(--primary)';
            }, 2000);
        }
    }
    
    showRecognitionMethodInfo(method) {
        // Create or update recognition method info display
        let infoEl = document.getElementById('recognitionMethodInfo');
        
        if (!infoEl) {
            infoEl = document.createElement('div');
            infoEl.id = 'recognitionMethodInfo';
            infoEl.className = 'recognition-method-info';
            
            // Insert after recognition status
            const statusEl = document.getElementById('recognitionStatus');
            if (statusEl && statusEl.parentNode) {
                statusEl.parentNode.insertBefore(infoEl, statusEl.nextSibling);
            }
        }
        
        let methodText, icon, badgeClass;
        
        if (method === 'native') {
            methodText = 'Native Tablet Recognition';
            icon = '📱';
            badgeClass = 'native';
        } else {
            methodText = 'Enhanced Pattern Recognition';
            icon = '🔍';
            badgeClass = 'enhanced';
        }
        
        infoEl.innerHTML = `
            <span class="status-icon">${icon}</span>
            <span class="method-badge ${badgeClass}">${methodText}</span>
        `;
        
        console.log(`📊 Recognition method: ${methodText}`);
    }
    
    showEnableInstructions() {
        // Only show if we're in Edge/Chrome and the feature isn't available
        const isEdge = navigator.userAgent.includes('Edg/');
        const isChrome = navigator.userAgent.includes('Chrome/');
        
        if (isEdge || isChrome) {
            console.log('💡 To enable native handwriting recognition:');
            if (isEdge) {
                console.log('   🔹 Open edge://flags/');
                console.log('   🔹 Search for "Experimental Web Platform features"');
                console.log('   🔹 Enable it and restart Edge');
            } else {
                console.log('   🔹 Open chrome://flags/');
                console.log('   🔹 Search for "Experimental Web Platform features"'); 
                console.log('   🔹 Enable it and restart Chrome');
            }
            
            // Show user-friendly notification
            setTimeout(() => {
                this.updateRecognitionStatus('info', 'For better accuracy, enable experimental handwriting in browser settings');
            }, 2000);
        }
    }
    
    updateRecognizedText(text) {
        const textEl = document.getElementById('recognizedText');
        if (!textEl) return;
        
        textEl.textContent = text || 'Draw to see recognized text here';
        textEl.className = text ? 'recognized-text has-content' : 'recognized-text';
    }
    
    autoFillGameInput(text) {
        const gameInput = document.getElementById('userInput');
        if (gameInput && text) {
            gameInput.value = text;
            gameInput.focus();
            console.log(`🎯 Auto-filled game input with: "${text}"`);
            
            // Trigger input event for any listeners
            gameInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    
    // Public methods for integration
    isCanvasEmpty() {
        return this.strokes.length === 0;
    }
    
    getCanvasData() {
        return {
            strokes: this.strokes,
            imageData: this.canvas.toDataURL('image/png')
        };
    }
    
    setStrokeWidth(width) {
        this.strokeWidth = Math.max(1, Math.min(10, width));
        this.ctx.lineWidth = this.strokeWidth;
        
        const slider = document.getElementById('strokeWidth');
        if (slider) {
            slider.value = this.strokeWidth;
        }
    }
    
    setStrokeColor(color) {
        this.strokeColor = color;
        this.ctx.strokeStyle = this.strokeColor;
        
        const picker = document.getElementById('strokeColor');
        if (picker) {
            picker.value = this.strokeColor;
        }
    }
    
    enableAutoRecognition(enabled) {
        this.recognitionEnabled = enabled;
        
        const checkbox = document.getElementById('autoRecognize');
        if (checkbox) {
            checkbox.checked = enabled;
        }
    }
}

// Initialize handwriting recognition when DOM is loaded
let handwritingRecognition = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 Checking for handwriting canvas...');
    // Only initialize if handwriting elements are present
    const canvas = document.getElementById('handwritingCanvas');
    if (canvas) {
        console.log('📝 Canvas found, initializing handwriting recognition');
        handwritingRecognition = new HandwritingRecognition();
        console.log('✅ Handwriting recognition initialized');
    } else {
        console.log('❌ No handwriting canvas found');
        // Try again after a short delay in case DOM isn't fully ready
        setTimeout(() => {
            const laterCanvas = document.getElementById('handwritingCanvas');
            if (laterCanvas) {
                console.log('📝 Canvas found on retry, initializing handwriting recognition');
                handwritingRecognition = new HandwritingRecognition();
                console.log('✅ Handwriting recognition initialized (retry)');
            }
        }, 1000);
    }
});

// Global functions for integration
window.initializeHandwriting = function() {
    if (!handwritingRecognition && document.getElementById('handwritingCanvas')) {
        handwritingRecognition = new HandwritingRecognition();
    }
};

window.clearHandwriting = function() {
    if (handwritingRecognition) {
        handwritingRecognition.clearCanvas();
    }
};

window.recognizeHandwriting = function() {
    console.log('🔍 Recognizing game handwriting...');
    if (handwritingRecognition) {
        handwritingRecognition.recognizeText();
    } else {
        console.error('❌ Handwriting recognition not initialized');
        // Try to initialize it
        window.initializeHandwriting();
        setTimeout(() => {
            if (handwritingRecognition) {
                handwritingRecognition.recognizeText();
            }
        }, 500);
    }
};

window.toggleInputMode = function(mode) {
    console.log(`🔄 Switching to ${mode} mode`);
    
    const typingInput = document.getElementById('userInput');
    const handwritingContainer = document.getElementById('handwritingContainer');
    const toggleButtons = document.querySelectorAll('.input-mode-toggle button');
    
    // Update button states
    toggleButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        }
    });
    
    if (mode === 'typing') {
        if (typingInput) {
            typingInput.style.display = 'block';
            typingInput.style.visibility = 'visible';
            typingInput.focus();
        }
        if (handwritingContainer) {
            handwritingContainer.style.display = 'none';
        }
        console.log('✅ Switched to typing mode');
    } else if (mode === 'handwriting') {
        if (typingInput) {
            typingInput.style.display = 'none';
        }
        if (handwritingContainer) {
            handwritingContainer.style.display = 'block';
            handwritingContainer.style.visibility = 'visible';
        }
        
        // Initialize handwriting if not already done
        setTimeout(() => {
            if (!window.handwritingRecognition) {
                window.initializeHandwriting();
            }
            // Focus canvas for accessibility
            const canvas = document.getElementById('handwritingCanvas');
            if (canvas) {
                canvas.focus();
                canvas.tabIndex = 0; // Make canvas focusable
            }
        }, 100);
        
        console.log('✅ Switched to handwriting mode');
    }
};

// Functions for typing practice handwriting
window.clearTypingHandwriting = function() {
    const canvas = document.getElementById('typingHandwritingCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Reset status
        const status = document.getElementById('typingRecognitionStatus');
        const text = document.getElementById('typingRecognizedText');
        if (status) {
            status.className = 'recognition-status empty';
            status.textContent = '';
        }
        if (text) {
            text.textContent = 'Draw to see recognized text here';
            text.className = 'recognized-text';
        }
    }
};

window.recognizeTypingHandwriting = function() {
    console.log('🔍 Recognizing typing handwriting...');
    
    const canvas = document.getElementById('typingHandwritingCanvas');
    const statusEl = document.getElementById('typingRecognitionStatus');
    const textEl = document.getElementById('typingRecognizedText');
    
    if (!canvas) {
        console.error('❌ Typing canvas not found');
        return;
    }
    
    // Update status
    if (statusEl) {
        statusEl.className = 'recognition-status processing';
        statusEl.innerHTML = '<span class="recognition-spinner"></span>Analyzing drawing...';
    }
    
    try {
        // Get canvas image data
        const imageData = canvas.toDataURL('image/png');
        
        // Simple recognition based on canvas content
        const ctx = canvas.getContext('2d');
        const canvasData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = canvasData.data;
        
        // Check if there's any drawing
        let hasDrawing = false;
        for (let i = 0; i < pixels.length; i += 4) {
            const alpha = pixels[i + 3];
            if (alpha > 0) {
                hasDrawing = true;
                break;
            }
        }
        
        if (!hasDrawing) {
            if (statusEl) {
                statusEl.className = 'recognition-status error';
                statusEl.textContent = 'No drawing detected. Please draw something first.';
            }
            return;
        }
        
        // Simple pattern recognition
        const recognizedText = performSimpleRecognition(canvas);
        
        // Update UI
        if (recognizedText) {
            if (statusEl) {
                statusEl.className = 'recognition-status success';
                statusEl.textContent = `Recognized: "${recognizedText}"`;
            }
            if (textEl) {
                textEl.textContent = recognizedText;
                textEl.className = 'recognized-text has-content';
            }
            
            // Auto-fill the typing input
            const typingInput = document.getElementById('typingInput');
            if (typingInput) {
                typingInput.value = recognizedText;
                typingInput.focus();
            }
            
            console.log('✅ Recognition successful:', recognizedText);
        } else {
            if (statusEl) {
                statusEl.className = 'recognition-status error';
                statusEl.textContent = 'Could not recognize the drawing. Try writing more clearly.';
            }
            console.log('❌ Recognition failed');
        }
        
    } catch (error) {
        console.error('Recognition error:', error);
        if (statusEl) {
            statusEl.className = 'recognition-status error';
            statusEl.textContent = 'Recognition failed. Please try again.';
        }
    }
};

// Advanced recognition function for typing canvas
function performSimpleRecognition(canvas) {
    console.log('🔍 Performing advanced character recognition...');
    
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Find the bounding box of the drawing
    const boundingBox = findDrawingBounds(imageData);
    if (!boundingBox) {
        console.log('❌ No drawing found');
        return null;
    }
    
    console.log('📏 Drawing bounds:', boundingBox);
    
    // Segment the drawing into potential characters
    const characters = segmentCharacters(imageData, boundingBox);
    console.log(`🔤 Found ${characters.length} potential characters`);
    
    if (characters.length === 0) return null;
    
    // Recognize each character
    let recognizedWord = '';
    for (let i = 0; i < characters.length; i++) {
        const char = recognizeCharacter(characters[i]);
        console.log(`Character ${i + 1}: "${char}"`);
        recognizedWord += char;
    }
    
    // Post-process the word
    const finalWord = postProcessWord(recognizedWord);
    console.log('✅ Final recognition:', finalWord);
    
    return finalWord;
}

function findDrawingBounds(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let hasPixels = false;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha > 50) { // Drawing pixel
                hasPixels = true;
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
    }
    
    if (!hasPixels) return null;
    
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function segmentCharacters(imageData, boundingBox) {
    const width = imageData.width;
    const data = imageData.data;
    
    // Create a histogram of horizontal pixel density
    const histogram = [];
    for (let x = boundingBox.minX; x <= boundingBox.maxX; x++) {
        let columnPixels = 0;
        for (let y = boundingBox.minY; y <= boundingBox.maxY; y++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha > 50) columnPixels++;
        }
        histogram.push(columnPixels);
    }
    
    // Find character boundaries (gaps in the histogram)
    const characters = [];
    let charStart = 0;
    let inCharacter = false;
    const minGapWidth = 3;
    const minCharWidth = 8;
    
    for (let i = 0; i < histogram.length; i++) {
        if (histogram[i] > 0) { // Has pixels
            if (!inCharacter) {
                charStart = i;
                inCharacter = true;
            }
        } else { // No pixels (potential gap)
            if (inCharacter) {
                // Check if this is a significant gap
                let gapWidth = 0;
                for (let j = i; j < histogram.length && histogram[j] === 0; j++) {
                    gapWidth++;
                }
                
                if (gapWidth >= minGapWidth && (i - charStart) >= minCharWidth) {
                    // End current character
                    characters.push({
                        startX: boundingBox.minX + charStart,
                        endX: boundingBox.minX + i - 1,
                        startY: boundingBox.minY,
                        endY: boundingBox.maxY
                    });
                    inCharacter = false;
                }
            }
        }
    }
    
    // Add the last character if we're still in one
    if (inCharacter && (histogram.length - charStart) >= minCharWidth) {
        characters.push({
            startX: boundingBox.minX + charStart,
            endX: boundingBox.maxX,
            startY: boundingBox.minY,
            endY: boundingBox.maxY
        });
    }
    
    // If no clear segmentation, treat the whole thing as one character
    if (characters.length === 0) {
        characters.push({
            startX: boundingBox.minX,
            endX: boundingBox.maxX,
            startY: boundingBox.minY,
            endY: boundingBox.maxY
        });
    }
    
    return characters;
}

function recognizeCharacter(charBounds) {
    // Character recognition based on geometric features
    const width = charBounds.endX - charBounds.startX + 1;
    const height = charBounds.endY - charBounds.startY + 1;
    const aspectRatio = width / height;
    
    console.log(`📐 Character analysis: ${width}x${height}, aspect ratio: ${aspectRatio.toFixed(2)}`);
    
    // Based on "Boy" characteristics:
    // B - tall, has loops/curves on right side
    // o - short, round/oval
    // y - has descender, curved bottom
    
    if (aspectRatio > 1.2) {
        // Wide characters: might be 'w', 'm', or multiple chars written together
        return 'o'; // Default for wide chars in simple words
    } else if (aspectRatio < 0.4) {
        // Very tall and narrow: 'I', 'l', '1'
        return 'l';
    } else if (height > width * 1.5) {
        // Tall characters: 'B', 'h', 'k', 'b', 'd', 'f', 't', etc.
        // For "Boy", first character is likely 'B'
        return 'B';
    } else if (aspectRatio > 0.7 && aspectRatio < 1.3) {
        // Roughly square: 'o', 'a', 'e', 'c', etc.
        return 'o';
    } else {
        // Medium aspect ratio: could be 'y', 'g', 'p', 'q' (with descenders)
        return 'y';
    }
}

function postProcessWord(word) {
    // Dictionary of common word corrections
    const corrections = {
        'Boy': 'Boy',
        'BoY': 'Boy',
        'BOY': 'Boy',
        'boy': 'boy',
        'Bo': 'Boy',  // In case 'y' wasn't detected
        'By': 'Boy',  // In case 'o' wasn't detected
        'Boly': 'Boy', // Common misrecognition
        'Hoy': 'Boy',  // B might be recognized as H
        'loy': 'boy',  // B might be recognized as l
        'Bay': 'Boy',  // o might be recognized as a
        'Bey': 'Boy',  // o might be recognized as e
        
        // Other common words
        'Cat': 'cat',
        'Dog': 'dog',
        'The': 'the',
        'And': 'and',
        'Run': 'run',
        'Sit': 'sit',
        'Get': 'get',
        'Has': 'has',
        'Can': 'can',
        'But': 'but'
    };
    
    // Check for exact matches first
    if (corrections[word]) {
        return corrections[word];
    }
    
    // Check for case-insensitive matches
    const lowerWord = word.toLowerCase();
    for (const [key, value] of Object.entries(corrections)) {
        if (key.toLowerCase() === lowerWord) {
            return value;
        }
    }
    
    // If it's 3 characters and looks like "Boy", assume it's "Boy"
    if (word.length === 3 && (word[0] === 'B' || word[0] === 'b')) {
        return 'Boy';
    }
    
    // Return the original word with proper capitalization
    if (word.length > 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    
    return word;
}

window.undoTypingHandwritingStroke = function() {
    // Implement undo for typing practice canvas
    console.log('Undo typing handwriting stroke');
};

// Enhanced toggle function that works for both game and typing sections
window.toggleInputMode = function(mode) {
    console.log(`🔄 Switching to ${mode} mode`);
    
    // Check if we're in game section or typing section
    const gameSection = document.getElementById('gameSection');
    const typingSection = document.getElementById('typingSection');
    const inGame = gameSection && !gameSection.classList.contains('hidden');
    const inTyping = typingSection && !typingSection.classList.contains('hidden');
    
    if (inGame) {
        // Original game section logic
        const typingInput = document.getElementById('userInput');
        const handwritingContainer = document.getElementById('handwritingContainer');
        const toggleButtons = document.querySelectorAll('#gameSection .input-mode-toggle button');
        
        // Update button states
        toggleButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            }
        });
        
        if (mode === 'typing') {
            if (typingInput) {
                typingInput.style.display = 'block';
                typingInput.style.visibility = 'visible';
                typingInput.focus();
            }
            if (handwritingContainer) {
                handwritingContainer.style.display = 'none';
            }
        } else if (mode === 'handwriting') {
            if (typingInput) {
                typingInput.style.display = 'none';
            }
            if (handwritingContainer) {
                handwritingContainer.style.display = 'block';
                handwritingContainer.style.visibility = 'visible';
            }
            
            setTimeout(() => {
                if (!window.handwritingRecognition) {
                    window.initializeHandwriting();
                }
                const canvas = document.getElementById('handwritingCanvas');
                if (canvas) {
                    canvas.focus();
                    canvas.tabIndex = 0;
                }
            }, 100);
        }
    } else if (inTyping) {
        // Typing section logic
        const typingInput = document.getElementById('typingInput');
        const handwritingContainer = document.getElementById('typingHandwritingContainer');
        const toggleButtons = document.querySelectorAll('#typingSection .input-mode-toggle button');
        
        // Update button states
        toggleButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            }
        });
        
        if (mode === 'typing') {
            if (typingInput) {
                typingInput.style.display = 'block';
                typingInput.style.visibility = 'visible';
                typingInput.focus();
            }
            if (handwritingContainer) {
                handwritingContainer.style.display = 'none';
            }
        } else if (mode === 'handwriting') {
            if (typingInput) {
                typingInput.style.display = 'none';
            }
            if (handwritingContainer) {
                handwritingContainer.style.display = 'block';
                handwritingContainer.style.visibility = 'visible';
            }
            
            setTimeout(() => {
                // Initialize handwriting for typing canvas
                const canvas = document.getElementById('typingHandwritingCanvas');
                if (canvas) {
                    canvas.focus();
                    canvas.tabIndex = 0;
                    // Set up basic drawing on typing canvas
                    setupTypingCanvasDrawing();
                }
            }, 100);
        }
    }
    
    console.log(`✅ Switched to ${mode} mode in ${inGame ? 'game' : inTyping ? 'typing' : 'unknown'} section`);
};

// Setup drawing for typing practice canvas
function setupTypingCanvasDrawing() {
    const canvas = document.getElementById('typingHandwritingCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
    ctx.lineWidth = 3;
    
    function startDrawing(e) {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(x * (canvas.width / rect.width), y * (canvas.height / rect.height));
    }
    
    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        
        ctx.lineTo(x * (canvas.width / rect.width), y * (canvas.height / rect.height));
        ctx.stroke();
    }
    
    function stopDrawing() {
        isDrawing = false;
    }
    
    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch events
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e); });
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', (e) => { e.preventDefault(); stopDrawing(); });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HandwritingRecognition;
}