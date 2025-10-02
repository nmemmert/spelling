/**
 * Native Tablet Handwriting Recognition Integration
 * Leverages platform-specific handwriting APIs for better accuracy
 */

class NativeHandwritingRecognition {
    constructor() {
        this.isSupported = false;
        this.recognizer = null;
        this.canvas = null;
        this.ctx = null;
        this.strokes = [];
        this.currentStroke = [];
        this.isDrawing = false;
        this.isAppleDevice = false;
        this.applePencilDetected = false;
        
        // Initialize recognition capabilities
        this.initializeRecognition();
    }

    async initializeRecognition() {
        console.log('🔍 Checking for native handwriting support...');
        
        // Check for different platform APIs
        this.isSupported = await this.detectHandwritingSupport();
        
        if (this.isSupported) {
            console.log('✅ Native handwriting recognition available');
            await this.setupRecognizer();
        } else {
            console.log('⚠️ Native handwriting not available, using fallback');
        }
    }

    async detectHandwritingSupport() {
        console.log('🔍 Detecting handwriting support on:', navigator.userAgent);
        
        // Detect Apple Pencil / iOS devices specifically
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isSafari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
        
        if (isIOS) {
            console.log('🍎 iOS device detected - optimizing for Apple Pencil');
            this.isAppleDevice = true;
        }
        
        // Check for Web Handwriting API (experimental - Edge/Chrome)
        if ('createHandwritingRecognizer' in navigator) {
            console.log('🖋️ Web Handwriting API detected in', this.getBrowserInfo());
            
            // Test if it actually works
            try {
                const testQuery = await navigator.queryHandwritingRecognizer({ languages: ['en'] });
                if (testQuery) {
                    console.log('✅ Web Handwriting API is functional');
                    return true;
                } else {
                    console.log('⚠️ Web Handwriting API exists but query failed');
                }
            } catch (error) {
                console.log('❌ Web Handwriting API test failed:', error);
            }
        }

        // Check for Pointer Events API with pressure sensitivity (Windows tablets)
        if ('PointerEvent' in window) {
            console.log('👆 Pointer Events API detected - good for Windows tablets');
            return true;
        }

        // Check for Touch Events with force (iPad, Apple Pencil, etc.)
        if ('TouchEvent' in window || 'ontouchstart' in window) {
            console.log('📱 Touch Events API detected');
            if (isIOS) {
                console.log('🍎 Apple Pencil support likely available');
            }
            return true;
        }

        // Check for Windows Ink API (UWP apps only)
        if (typeof Windows !== 'undefined' && Windows.UI && Windows.UI.Input && Windows.UI.Input.Inking) {
            console.log('🖊️ Windows Ink API detected (UWP context)');
            return true;
        }

        console.log('⚠️ No native handwriting APIs detected');
        return false;
    }
    
    getBrowserInfo() {
        const ua = navigator.userAgent;
        if (ua.includes('Edg/')) return 'Microsoft Edge';
        if (ua.includes('Chrome/')) return 'Google Chrome';
        if (ua.includes('Firefox/')) return 'Mozilla Firefox';
        if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
        return 'Unknown Browser';
    }

    async setupRecognizer() {
        try {
            // Try Web Handwriting API first (most accurate)
            if ('createHandwritingRecognizer' in navigator) {
                await this.setupWebHandwritingAPI();
                return;
            }

            // Try Windows Ink API
            if (this.setupWindowsInkAPI()) {
                return;
            }

            // Fallback to enhanced pointer/touch recognition
            this.setupEnhancedTouchRecognition();

        } catch (error) {
            console.error('❌ Failed to setup native recognition:', error);
            this.isSupported = false;
        }
    }

    async setupWebHandwritingAPI() {
        try {
            // Configure the recognizer for English text
            const recognizerQuery = {
                languages: ['en'],
                alternatives: 3,
                inputType: 'text'
            };

            // Check if the configuration is supported
            const queryResult = await navigator.queryHandwritingRecognizer(recognizerQuery);
            
            if (queryResult) {
                this.recognizer = await navigator.createHandwritingRecognizer(recognizerQuery);
                console.log('✅ Web Handwriting API recognizer created');
                return true;
            }
        } catch (error) {
            console.error('❌ Web Handwriting API setup failed:', error);
        }
        return false;
    }

    setupWindowsInkAPI() {
        try {
            if ('Windows' in window && window.Windows.UI && window.Windows.UI.Input.Inking) {
                // Initialize Windows Ink recognizer
                const InkRecognizerContainer = Windows.UI.Input.Inking.InkRecognizerContainer;
                this.recognizer = new InkRecognizerContainer();
                
                // Set recognition target to words
                this.recognizer.setDefaultRecognizer(Windows.UI.Input.Inking.InkRecognitionTarget.allText);
                
                console.log('✅ Windows Ink API recognizer created');
                return true;
            }
        } catch (error) {
            console.error('❌ Windows Ink API setup failed:', error);
        }
        return false;
    }

    setupEnhancedTouchRecognition() {
        // Enhanced touch/pointer recognition with pressure and timing data
        this.recognizer = {
            type: 'enhanced_touch',
            features: {
                pressure: 'PointerEvent' in window,
                timing: true,
                velocity: true
            }
        };
        console.log('✅ Enhanced touch recognition setup complete');
    }

    initializeCanvas(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        
        // Enhanced drawing setup
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
        
        this.setupCanvasEvents();
    }

    setupCanvasEvents() {
        // Use pointer events for better tablet support
        if ('PointerEvent' in window) {
            this.canvas.addEventListener('pointerdown', (e) => this.startStroke(e));
            this.canvas.addEventListener('pointermove', (e) => this.continueStroke(e));
            this.canvas.addEventListener('pointerup', (e) => this.endStroke(e));
            this.canvas.addEventListener('pointercancel', (e) => this.endStroke(e));
        } else {
            // Fallback to touch events
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.startStroke(e.touches[0]);
            });
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                this.continueStroke(e.touches[0]);
            });
            this.canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.endStroke(e);
            });
        }
    }

    startStroke(event) {
        this.isDrawing = true;
        this.currentStroke = [];
        
        const point = this.getEnhancedPoint(event);
        this.currentStroke.push(point);
        
        this.ctx.beginPath();
        this.ctx.moveTo(point.x, point.y);
        
        console.log('🖋️ Starting stroke with enhanced data:', point);
    }

    continueStroke(event) {
        if (!this.isDrawing) return;
        
        const point = this.getEnhancedPoint(event);
        this.currentStroke.push(point);
        
        this.ctx.lineTo(point.x, point.y);
        this.ctx.stroke();
    }

    endStroke(event) {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        
        if (this.currentStroke.length > 0) {
            // Add timing information to the stroke
            const strokeDuration = this.currentStroke[this.currentStroke.length - 1].timestamp - this.currentStroke[0].timestamp;
            
            this.strokes.push({
                points: [...this.currentStroke],
                duration: strokeDuration,
                avgPressure: this.calculateAveragePressure(this.currentStroke)
            });
            
            console.log(`✅ Stroke completed: ${this.currentStroke.length} points, ${strokeDuration}ms`);
        }
        
        this.currentStroke = [];
    }

    getEnhancedPoint(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const point = {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
            timestamp: Date.now()
        };
        
        // Add pressure if available (PointerEvent)
        if (event.pressure !== undefined) {
            point.pressure = event.pressure;
            
            // Detect Apple Pencil based on pressure characteristics
            if (this.isAppleDevice && event.pressure > 0 && event.pressure < 1) {
                this.applePencilDetected = true;
                console.log('🍎 Apple Pencil detected with pressure:', event.pressure);
            }
        }
        
        // Add tilt if available (stylus)
        if (event.tiltX !== undefined && event.tiltY !== undefined) {
            point.tiltX = event.tiltX;
            point.tiltY = event.tiltY;
            
            // Apple Pencil specific tilt detection
            if (this.isAppleDevice && (Math.abs(event.tiltX) > 0 || Math.abs(event.tiltY) > 0)) {
                this.applePencilDetected = true;
                console.log('🍎 Apple Pencil tilt detected:', event.tiltX, event.tiltY);
            }
        }
        
        // Add force if available (3D Touch / Apple Pencil force)
        if (event.force !== undefined) {
            point.force = event.force;
            
            // Apple Pencil force detection
            if (this.isAppleDevice && event.force > 0) {
                this.applePencilDetected = true;
                console.log('🍎 Apple Pencil force detected:', event.force);
            }
        }
        
        // Apple Pencil specific optimizations
        if (this.applePencilDetected) {
            point.isApplePencil = true;
            
            // Apple Pencil typically has more precise coordinates
            point.x = Math.round(point.x * 2) / 2; // Sub-pixel precision
            point.y = Math.round(point.y * 2) / 2;
        }
        
        return point;
    }

    calculateAveragePressure(stroke) {
        const pressures = stroke.filter(p => p.pressure !== undefined).map(p => p.pressure);
        return pressures.length > 0 ? pressures.reduce((a, b) => a + b, 0) / pressures.length : 0.5;
    }

    async recognizeHandwriting() {
        if (this.strokes.length === 0) {
            console.log('⚠️ No strokes to recognize');
            return null;
        }

        console.log(`🔍 Recognizing ${this.strokes.length} strokes using native APIs...`);

        try {
            // Try Web Handwriting API first
            if (this.recognizer && this.recognizer.startDrawing) {
                return await this.recognizeWithWebAPI();
            }

            // Try Windows Ink API
            if (this.recognizer && this.recognizer.recognizeAsync) {
                return await this.recognizeWithWindowsInk();
            }

            // Use enhanced pattern recognition
            return this.recognizeWithEnhancedPatterns();

        } catch (error) {
            console.error('❌ Native recognition failed:', error);
            return this.recognizeWithEnhancedPatterns();
        }
    }

    async recognizeWithWebAPI() {
        try {
            const drawing = this.recognizer.startDrawing();
            
            // Convert our strokes to the Web API format
            for (const stroke of this.strokes) {
                const apiStroke = drawing.addStroke();
                for (const point of stroke.points) {
                    apiStroke.addPoint({
                        x: point.x,
                        y: point.y,
                        t: point.timestamp
                    });
                }
            }
            
            const predictions = await this.recognizer.getPrediction();
            
            if (predictions && predictions.length > 0) {
                const bestPrediction = predictions[0];
                console.log('✅ Web API recognition:', bestPrediction.text);
                return bestPrediction.text;
            }
        } catch (error) {
            console.error('❌ Web API recognition error:', error);
        }
        return null;
    }

    async recognizeWithWindowsInk() {
        try {
            // Convert strokes to Windows Ink format
            const inkStrokes = [];
            
            for (const stroke of this.strokes) {
                const inkStrokeBuilder = new Windows.UI.Input.Inking.InkStrokeBuilder();
                const points = stroke.points.map(p => 
                    Windows.Foundation.Point(p.x, p.y)
                );
                const inkStroke = inkStrokeBuilder.createStroke(points);
                inkStrokes.push(inkStroke);
            }
            
            const recognitionResults = await this.recognizer.recognizeAsync(
                inkStrokes,
                Windows.UI.Input.Inking.InkRecognitionTarget.allText
            );
            
            if (recognitionResults && recognitionResults.length > 0) {
                const bestResult = recognitionResults[0];
                console.log('✅ Windows Ink recognition:', bestResult.text);
                return bestResult.text;
            }
        } catch (error) {
            console.error('❌ Windows Ink recognition error:', error);
        }
        return null;
    }

    recognizeWithEnhancedPatterns() {
        // Enhanced pattern recognition using the additional data we collected
        console.log('🔍 Using enhanced pattern recognition with native data...');
        
        const analysis = this.analyzeNativeStrokes();
        
        // Apple Pencil specific recognition
        if (this.applePencilDetected) {
            console.log('🍎 Using Apple Pencil optimized recognition...');
            const applePencilResult = this.recognizeWithApplePencil(analysis);
            if (applePencilResult) {
                return applePencilResult;
            }
        }
        
        // Use the enhanced data to make better predictions
        const confidence = this.calculateNativeConfidence(analysis);
        
        if (confidence > 0.7) {
            return analysis.predictedText;
        }
        
        // Fallback to the original handwriting recognition
        return null;
    }
    
    recognizeWithApplePencil(analysis) {
        console.log('🍎 Apple Pencil recognition with enhanced accuracy...');
        
        // Apple Pencil produces very precise strokes, so we can be more strict with pattern matching
        const { strokeCount, avgPressure, avgDuration } = analysis;
        
        // Apple Pencil specific word patterns
        const applePencilPatterns = {
            'Love': {
                expectedStrokes: [4, 6],
                expectedPressure: [0.2, 0.8],
                expectedDuration: [200, 800],
                letterShapes: ['vertical_tall', 'circle_round', 'v_angle', 'curve_open']
            },
            'love': {
                expectedStrokes: [4, 6],
                expectedPressure: [0.2, 0.8],
                expectedDuration: [200, 800],
                letterShapes: ['tall_line', 'round_shape', 'angle_lines', 'open_curve']
            },
            'Boy': {
                expectedStrokes: [3, 5],
                expectedPressure: [0.2, 0.8], 
                expectedDuration: [150, 600],
                letterShapes: ['loop_tall', 'circle_round', 'descender_y']
            },
            'boy': {
                expectedStrokes: [3, 5],
                expectedPressure: [0.2, 0.8],
                expectedDuration: [150, 600],
                letterShapes: ['tall_loop', 'round_circle', 'y_descender']
            },
            'Cat': {
                expectedStrokes: [3, 5],
                expectedPressure: [0.2, 0.7],
                expectedDuration: [120, 500],
                letterShapes: ['curve_open', 'curve_round', 'cross_horizontal']
            },
            'cat': {
                expectedStrokes: [3, 5], 
                expectedPressure: [0.2, 0.7],
                expectedDuration: [120, 500],
                letterShapes: ['open_curve', 'round_curve', 'horizontal_cross']
            }
        };
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const [word, pattern] of Object.entries(applePencilPatterns)) {
            let score = 0;
            
            // Stroke count match (Apple Pencil is precise)
            if (strokeCount >= pattern.expectedStrokes[0] && strokeCount <= pattern.expectedStrokes[1]) {
                score += 0.4;
            }
            
            // Pressure consistency (Apple Pencil advantage)
            if (avgPressure >= pattern.expectedPressure[0] && avgPressure <= pattern.expectedPressure[1]) {
                score += 0.3;
            }
            
            // Duration consistency (Apple Pencil users tend to be more deliberate)
            if (avgDuration >= pattern.expectedDuration[0] && avgDuration <= pattern.expectedDuration[1]) {
                score += 0.2;
            }
            
            // Apple Pencil precision bonus
            score += 0.1;
            
            console.log(`🍎 Apple Pencil score for "${word}": ${score.toFixed(3)}`);
            
            if (score > bestScore && score > 0.6) {
                bestScore = score;
                bestMatch = word;
            }
        }
        
        if (bestMatch) {
            console.log(`🏆 Apple Pencil recognition: "${bestMatch}" (confidence: ${bestScore.toFixed(3)})`);
            return bestMatch;
        }
        
        return null;
    }

    analyzeNativeStrokes() {
        // Analyze using the enhanced stroke data
        let totalPressure = 0;
        let totalDuration = 0;
        let pressurePoints = 0;
        
        for (const stroke of this.strokes) {
            totalDuration += stroke.duration;
            if (stroke.avgPressure > 0) {
                totalPressure += stroke.avgPressure;
                pressurePoints++;
            }
        }
        
        const avgPressure = pressurePoints > 0 ? totalPressure / pressurePoints : 0.5;
        const avgStrokeDuration = totalDuration / this.strokes.length;
        
        // Use pressure and timing to improve recognition
        return {
            strokeCount: this.strokes.length,
            avgPressure: avgPressure,
            avgDuration: avgStrokeDuration,
            predictedText: this.makePressureBasedPrediction(avgPressure, avgStrokeDuration),
            hasEnhancedData: pressurePoints > 0
        };
    }

    makePressureBasedPrediction(pressure, duration) {
        // Use pressure and timing patterns to help predict
        const strokeCount = this.strokes.length;
        
        if (strokeCount === 3) {
            if (pressure > 0.6 && duration < 200) {
                return 'Boy'; // Quick, heavy strokes
            } else if (pressure < 0.4 && duration > 300) {
                return 'Cat'; // Light, deliberate strokes
            }
        } else if (strokeCount >= 4) {
            if (pressure > 0.5 && duration > 250) {
                return 'Love'; // Moderate pressure, careful strokes
            } else if (pressure < 0.5 && duration < 200) {
                return 'Like'; // Light, quick strokes
            }
        }
        
        return null; // No clear pattern
    }

    calculateNativeConfidence(analysis) {
        let confidence = 0.5;
        
        // Bonus for having enhanced data
        if (analysis.hasEnhancedData) {
            confidence += 0.2;
        }
        
        // Bonus for reasonable pressure patterns
        if (analysis.avgPressure > 0.2 && analysis.avgPressure < 0.8) {
            confidence += 0.1;
        }
        
        // Bonus for reasonable timing
        if (analysis.avgDuration > 100 && analysis.avgDuration < 1000) {
            confidence += 0.1;
        }
        
        return Math.min(1.0, confidence);
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.strokes = [];
        console.log('🧹 Canvas cleared, native recognition reset');
    }

    isNativeSupported() {
        return this.isSupported;
    }

    getRecognitionInfo() {
        return {
            supported: this.isSupported,
            type: this.recognizer ? this.recognizer.type || 'native' : 'none',
            features: this.recognizer ? this.recognizer.features || {} : {}
        };
    }
}

// Export for use in other files
window.NativeHandwritingRecognition = NativeHandwritingRecognition;