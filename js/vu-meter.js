/**
 * VU-METER.JS - Mediahouse Crew Dashboard
 * Broadcast-quality audio level metering using Web Audio API
 * 
 * FEATURES:
 * - Stereo L/R channel display
 * - Peak hold indicators
 * - Color zones: Green (-40 to -12dB), Yellow (-12 to -6dB), Red (-6 to 0dB)
 * - dB scale markings
 * - 60fps smooth animation
 * 
 * TROUBLESHOOTING:
 * - No audio? AudioContext must be resumed after user interaction
 * - CORS errors? Mux handles this automatically for their CDN
 * - Meters stuck? Check video element is actually playing
 * - Safari issues? May need webkit prefix for AudioContext
 * 
 * TECHNICAL NOTES:
 * - Uses AnalyserNode for real-time frequency data
 * - Peak detection with decay for professional look
 * - Calibrated to match broadcast VU meter standards
 */

class VUMeter {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.audioContext = null;
        this.analyserL = null;
        this.analyserR = null;
        this.splitter = null;
        this.source = null;
        this.gainNode = null;
        
        // Status for debugging
        this.status = 'waiting'; // waiting, initializing, active, error
        this.errorMsg = '';
        
        // Peak hold values
        this.peakL = 0;
        this.peakR = 0;
        this.peakDecay = 0.95;
        this.peakHoldTime = 1000;
        this.lastPeakTimeL = 0;
        this.lastPeakTimeR = 0;
        
        // Animation state
        this.isRunning = false;
        this.animationId = null;
        
        // Meter configuration
        this.config = {
            barWidth: 20,
            barGap: 8,
            padding: 10,
            greenMax: -12,   // dB
            yellowMax: -6,   // dB
            redMax: 0,       // dB
            minDb: -60,
            maxDb: 3
        };
        
        // Draw initial state showing "CLICK" message
        this.clearCanvas();
    }
    
    /**
     * Initialize audio context and connect to video element
     * Must be called after user interaction (click/tap)
     */
    async init() {
        this.status = 'initializing';
        console.log('[VU] Starting initialization...');
        
        try {
            // Create audio context (with webkit fallback for Safari)
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            console.log('[VU] AudioContext created, state:', this.audioContext.state);
            
            // Resume if suspended (browser autoplay policy)
            if (this.audioContext.state === 'suspended') {
                console.log('[VU] Resuming suspended AudioContext...');
                await this.audioContext.resume();
                console.log('[VU] AudioContext resumed, state:', this.audioContext.state);
            }
            
            // We now receive a plain video element directly (not mux-player)
            const mediaElement = this.video;
            console.log('[VU] Video element:', mediaElement.tagName, 'id:', mediaElement.id);
            
            // Validate it's an actual video element
            if (!(mediaElement instanceof HTMLVideoElement)) {
                this.status = 'error';
                this.errorMsg = 'Not a video element';
                console.error('[VU] Expected HTMLVideoElement, got:', typeof mediaElement);
                return false;
            }
            
            console.log('[VU] Video readyState:', mediaElement.readyState, 'crossOrigin:', mediaElement.crossOrigin, 'muted:', mediaElement.muted);
            
            // IMPORTANT: Set video volume to 1 so audio flows to our analyser
            // We'll control actual speaker output with a GainNode instead
            console.log('[VU] Setting video.volume = 1 for analysis (was:', mediaElement.volume, ')');
            mediaElement.volume = 1;
            
            // Unmute the video so audio data flows through Web Audio API
            if (mediaElement.muted) {
                console.log('[VU] Unmuting video for audio analysis...');
                mediaElement.muted = false;
            }
            
            // Wait for video to have some data loaded
            if (mediaElement.readyState < 2) {
                console.log('[VU] Waiting for video data...');
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        console.warn('[VU] Timeout waiting for video data');
                        resolve(); // Continue anyway
                    }, 5000);
                    mediaElement.addEventListener('loadeddata', () => {
                        clearTimeout(timeout);
                        console.log('[VU] Video data loaded');
                        resolve();
                    }, { once: true });
                });
            }
            
            // Check if this element already has an audio source attached
            if (this.source) {
                console.log('[VU] Audio source already exists');
                this.status = 'active';
                return true;
            }
            
            // Create source from video element
            try {
                console.log('[VU] Creating MediaElementSource...');
                this.source = this.audioContext.createMediaElementSource(mediaElement);
                console.log('[VU] MediaElementSource created successfully!');
            } catch (e) {
                if (e.name === 'InvalidStateError') {
                    console.warn('[VU] MediaElementSource already exists for this element');
                    this.status = 'error';
                    this.errorMsg = 'Already connected';
                    return false;
                }
                throw e;
            }
            
            // Create channel splitter for stereo
            this.splitter = this.audioContext.createChannelSplitter(2);
            
            // Create analysers for each channel
            this.analyserL = this.audioContext.createAnalyser();
            this.analyserR = this.audioContext.createAnalyser();
            this.analyserL.fftSize = 2048;
            this.analyserR.fftSize = 2048;
            this.analyserL.smoothingTimeConstant = 0.3;
            this.analyserR.smoothingTimeConstant = 0.3;
            
            // Create gain node for volume control (separate from VU analysis)
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 0; // Start muted - user can unmute via controls
            
            // Connect: source -> splitter -> analysers (VU gets full signal)
            this.source.connect(this.splitter);
            this.splitter.connect(this.analyserL, 0);
            this.splitter.connect(this.analyserR, 1);
            
            // Connect: source -> gain -> destination (speaker output controlled separately)
            this.source.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);
            
            console.log('[VU] Audio graph connected successfully');
            this.status = 'active';
            return true;
        } catch (error) {
            console.error('[VU] Init failed:', error.name, error.message);
            this.status = 'error';
            this.errorMsg = error.message;
            return false;
        }
    }
    
    /**
     * Start the VU meter animation
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.draw();
        console.log('[VU] Started');
    }
    
    /**
     * Stop the VU meter animation
     */
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        // Draw empty meters
        this.clearCanvas();
        console.log('[VU] Stopped');
    }
    
    /**
     * Get RMS level from analyser (returns dB value)
     */
    getLevel(analyser) {
        const dataArray = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatTimeDomainData(dataArray);
        
        // Calculate RMS
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        
        // Convert to dB
        const db = 20 * Math.log10(rms);
        
        // Clamp to range
        return Math.max(this.config.minDb, Math.min(this.config.maxDb, db));
    }
    
    /**
     * Convert dB to pixel height
     */
    dbToHeight(db) {
        const range = this.config.maxDb - this.config.minDb;
        const normalized = (db - this.config.minDb) / range;
        return normalized * (this.canvas.height - this.config.padding * 2);
    }
    
    /**
     * Get color for given dB level
     */
    getColor(db) {
        if (db >= this.config.yellowMax) return '#ef4444'; // Red
        if (db >= this.config.greenMax) return '#eab308';  // Yellow
        return '#22c55e'; // Green
    }
    
    /**
     * Clear canvas and show status
     */
    clearCanvas() {
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawScale();
        
        // Show status message when not active
        if (this.status !== 'active' || !this.isRunning) {
            this.drawStatus();
        }
    }
    
    /**
     * Draw status message on canvas
     */
    drawStatus() {
        const msg = {
            'waiting': 'TAP',
            'initializing': '...',
            'active': '',
            'error': 'ERR'
        }[this.status] || '?';
        
        if (msg) {
            // Draw semi-transparent background
            if (this.status === 'waiting') {
                this.ctx.fillStyle = 'rgba(34, 197, 94, 0.3)'; // Green hint
                this.ctx.fillRect(10, this.canvas.height/2 - 20, this.canvas.width - 20, 40);
            }
            
            this.ctx.fillStyle = this.status === 'error' ? '#ef4444' : '#22c55e';
            this.ctx.font = 'bold 14px system-ui';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(msg, this.canvas.width / 2, this.canvas.height / 2 + 5);
            
            if (this.status === 'error' && this.errorMsg) {
                this.ctx.font = '8px system-ui';
                this.ctx.fillStyle = '#ef4444';
                this.ctx.fillText(this.errorMsg.substring(0, 10), this.canvas.width / 2, this.canvas.height / 2 + 18);
            }
        }
    }
    
    /**
     * Draw dB scale markings
     */
    drawScale() {
        this.ctx.fillStyle = '#666';
        this.ctx.font = '10px system-ui';
        this.ctx.textAlign = 'right';
        
        const marks = [0, -6, -12, -24, -40];
        marks.forEach(db => {
            const y = this.canvas.height - this.config.padding - this.dbToHeight(db);
            this.ctx.fillText(db.toString(), this.config.padding - 2, y + 3);
        });
    }
    
    /**
     * Draw a single meter bar
     */
    drawBar(x, db, peak) {
        const height = this.dbToHeight(db);
        const peakHeight = this.dbToHeight(peak);
        const y = this.canvas.height - this.config.padding;
        
        // Draw segmented bar for color zones
        const segments = [
            { max: this.config.greenMax, color: '#22c55e' },
            { max: this.config.yellowMax, color: '#eab308' },
            { max: this.config.maxDb, color: '#ef4444' }
        ];
        
        let drawnHeight = 0;
        segments.forEach(seg => {
            const segTop = this.dbToHeight(seg.max);
            if (height > drawnHeight) {
                const segHeight = Math.min(height - drawnHeight, segTop - drawnHeight);
                if (segHeight > 0) {
                    this.ctx.fillStyle = seg.color;
                    this.ctx.fillRect(x, y - drawnHeight - segHeight, this.config.barWidth, segHeight);
                }
                drawnHeight = segTop;
            }
        });
        
        // Draw peak indicator
        if (peak > this.config.minDb + 5) {
            this.ctx.fillStyle = this.getColor(peak);
            this.ctx.fillRect(x, y - peakHeight - 2, this.config.barWidth, 2);
        }
    }
    
    /**
     * Main draw loop - runs at 60fps
     */
    draw() {
        if (!this.isRunning) return;
        
        // Get current levels
        const levelL = this.getLevel(this.analyserL);
        const levelR = this.getLevel(this.analyserR);
        const now = Date.now();
        
        // Debug: log levels every second
        if (!this._lastDebugTime || now - this._lastDebugTime > 1000) {
            console.log(`[VU] Levels: L=${levelL.toFixed(1)}dB R=${levelR.toFixed(1)}dB`);
            this._lastDebugTime = now;
        }
        
        // Update peaks with hold and decay
        if (levelL > this.peakL) {
            this.peakL = levelL;
            this.lastPeakTimeL = now;
        } else if (now - this.lastPeakTimeL > this.peakHoldTime) {
            this.peakL *= this.peakDecay;
        }
        
        if (levelR > this.peakR) {
            this.peakR = levelR;
            this.lastPeakTimeR = now;
        } else if (now - this.lastPeakTimeR > this.peakHoldTime) {
            this.peakR *= this.peakDecay;
        }
        
        // Clear and redraw
        this.clearCanvas();
        
        // Calculate bar positions
        const centerX = this.canvas.width / 2;
        const leftX = centerX - this.config.barWidth - this.config.barGap / 2;
        const rightX = centerX + this.config.barGap / 2;
        
        // Draw L and R labels
        this.ctx.fillStyle = '#888';
        this.ctx.font = 'bold 11px system-ui';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('L', leftX + this.config.barWidth / 2, 12);
        this.ctx.fillText('R', rightX + this.config.barWidth / 2, 12);
        
        // DEBUG: Show actual dB values at bottom
        this.ctx.fillStyle = '#0ff';
        this.ctx.font = '9px monospace';
        this.ctx.fillText(levelL.toFixed(0), leftX + this.config.barWidth / 2, this.canvas.height - 2);
        this.ctx.fillText(levelR.toFixed(0), rightX + this.config.barWidth / 2, this.canvas.height - 2);
        
        // DEBUG: Show muted state
        this.ctx.fillStyle = this.video.muted ? '#f00' : '#0f0';
        this.ctx.font = '8px system-ui';
        this.ctx.fillText(this.video.muted ? 'M' : 'U', this.canvas.width - 10, 12);
        
        // Draw meter bars
        this.drawBar(leftX, levelL, this.peakL);
        this.drawBar(rightX, levelR, this.peakR);
        
        // Continue animation
        this.animationId = requestAnimationFrame(() => this.draw());
    }
}
