/**
 * VU-METER.JS - Mediahouse Crew Dashboard
 * Audio Activity Meter using webkitAudioDecodedByteCount
 * 
 * WHY THIS APPROACH:
 * - Web Audio API doesn't work with HLS streams (CORS/MediaSource limitations)
 * - webkitAudioDecodedByteCount tracks audio bytes decoded by the browser
 * - By measuring the RATE of bytes decoded, we can infer audio activity
 * - Louder/busier audio = more bytes per second = higher meter level
 * 
 * BROWSER SUPPORT:
 * - Chrome: ✅ Yes
 * - Safari: ✅ Yes  
 * - Edge: ✅ Yes (Chromium-based)
 * - Firefox: ❌ No - shows "N/A" indicator
 * 
 * LIMITATIONS:
 * - This measures audio DATA throughput, not actual volume/loudness
 * - Compressed audio doesn't have linear bytes-to-loudness relationship
 * - But it DOES indicate "is there audio activity?" which is what crew needs
 */

class VUMeter {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        
        // Byte rate tracking
        this.lastBytes = 0;
        this.lastTime = performance.now();
        this.smoothedLevel = 0;
        this.peakLevel = 0;
        this.peakHoldTime = 1500; // ms to hold peak
        this.lastPeakTime = 0;
        
        // Animation state
        this.isRunning = false;
        this.pollInterval = null;
        this.animationId = null;
        
        // Check browser support
        this.isSupported = this.checkSupport();
        
        // Meter configuration
        this.config = {
            barWidth: 40,           // Wide single bar
            padding: 15,
            topPadding: 25,         // Space for label
            bottomPadding: 10,
            greenMax: 0.5,          // 0-50% = green
            yellowMax: 0.8,         // 50-80% = yellow
            redMax: 1.0,            // 80-100% = red
            minSliver: 0.03,        // Minimum 3% bar when silent (tiny sliver)
            smoothingFactor: 0.25,  // How quickly meter responds (0.1=slow, 0.5=fast)
            peakDecay: 0.98,        // How fast peak falls
            // Calibration: typical audio byte rates for Mux HLS streams
            // Adjusted based on real-world testing - streams show ~10-30k bytes/sec
            minBytesPerSec: 500,    // Below this = silence
            maxBytesPerSec: 40000   // Above this = full meter
        };
        
        // Draw initial state
        this.drawInitial();
    }
    
    /**
     * Check if webkitAudioDecodedByteCount is supported
     */
    checkSupport() {
        // Create a test video element to check
        const testVideo = document.createElement('video');
        const supported = 'webkitAudioDecodedByteCount' in testVideo;
        console.log(`[VU] webkitAudioDecodedByteCount supported: ${supported}`);
        return supported;
    }
    
    /**
     * Initialize - no async needed, no user interaction required!
     */
    init() {
        if (!this.isSupported) {
            console.log('[VU] Browser does not support webkitAudioDecodedByteCount');
            this.drawNotSupported();
            return false;
        }
        
        console.log('[VU] Initialized (byte-rate mode)');
        return true;
    }
    
    /**
     * Start the VU meter
     */
    start() {
        if (this.isRunning) return;
        if (!this.isSupported) {
            this.drawNotSupported();
            return;
        }
        
        this.isRunning = true;
        this.lastBytes = this.video.webkitAudioDecodedByteCount || 0;
        this.lastTime = performance.now();
        
        // Poll byte count every 100ms
        this.pollInterval = setInterval(() => this.pollAudio(), 100);
        
        // Start render loop
        this.render();
        
        console.log('[VU] Started');
    }
    
    /**
     * Stop the VU meter
     */
    stop() {
        this.isRunning = false;
        
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        this.smoothedLevel = 0;
        this.peakLevel = 0;
        this.drawInitial();
        
        console.log('[VU] Stopped');
    }
    
    /**
     * Poll audio byte count and calculate level
     */
    pollAudio() {
        if (!this.video || !this.isRunning) return;
        
        const currentBytes = this.video.webkitAudioDecodedByteCount || 0;
        const currentTime = performance.now();
        
        const bytesDelta = currentBytes - this.lastBytes;
        const timeDelta = (currentTime - this.lastTime) / 1000; // seconds
        
        // Avoid division by zero
        if (timeDelta <= 0) return;
        
        const bytesPerSecond = bytesDelta / timeDelta;
        
        // Map bytes/sec to 0-1 level
        const range = this.config.maxBytesPerSec - this.config.minBytesPerSec;
        let rawLevel = (bytesPerSecond - this.config.minBytesPerSec) / range;
        rawLevel = Math.max(0, Math.min(1, rawLevel));
        
        // Apply smoothing for natural movement
        this.smoothedLevel = this.smoothedLevel * (1 - this.config.smoothingFactor) 
                          + rawLevel * this.config.smoothingFactor;
        
        // Ensure minimum sliver when there's any audio data
        if (bytesPerSecond > 0 && this.smoothedLevel < this.config.minSliver) {
            this.smoothedLevel = this.config.minSliver;
        }
        
        // Update peak with hold
        const now = Date.now();
        if (this.smoothedLevel > this.peakLevel) {
            this.peakLevel = this.smoothedLevel;
            this.lastPeakTime = now;
        } else if (now - this.lastPeakTime > this.peakHoldTime) {
            // Decay peak
            this.peakLevel *= this.config.peakDecay;
        }
        
        // Store for next poll
        this.lastBytes = currentBytes;
        this.lastTime = currentTime;
        
        // Debug log every second
        if (!this._lastDebugTime || now - this._lastDebugTime > 2000) {
            console.log(`[VU] bytes/sec: ${Math.round(bytesPerSecond)}, level: ${(this.smoothedLevel * 100).toFixed(0)}%`);
            this._lastDebugTime = now;
        }
    }
    
    /**
     * Render loop - draws the meter at 60fps
     */
    render() {
        if (!this.isRunning) return;
        
        this.drawMeter(this.smoothedLevel, this.peakLevel);
        
        this.animationId = requestAnimationFrame(() => this.render());
    }
    
    /**
     * Draw the initial/idle state
     */
    drawInitial() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Dark background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, w, h);
        
        // Draw empty meter outline
        this.drawMeterOutline();
        
        // Show "AUDIO" label
        ctx.fillStyle = '#666';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('AUDIO', w / 2, 14);
    }
    
    /**
     * Draw "Not Supported" for Firefox
     */
    drawNotSupported() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Dark background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, w, h);
        
        // Draw meter outline
        this.drawMeterOutline();
        
        // Show "N/A" message
        ctx.fillStyle = '#666';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('AUDIO', w / 2, 14);
        
        ctx.fillStyle = '#888';
        ctx.font = 'bold 16px system-ui';
        ctx.fillText('N/A', w / 2, h / 2 + 5);
        
        ctx.font = '9px system-ui';
        ctx.fillStyle = '#555';
        ctx.fillText('Use Chrome', w / 2, h / 2 + 22);
    }
    
    /**
     * Draw meter outline/background
     */
    drawMeterOutline() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        const barX = (w - this.config.barWidth) / 2;
        const barTop = this.config.topPadding;
        const barHeight = h - this.config.topPadding - this.config.bottomPadding;
        
        // Meter background (dark gray)
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(barX, barTop, this.config.barWidth, barHeight);
        
        // Draw dB-like scale marks on the side
        ctx.fillStyle = '#444';
        ctx.font = '8px system-ui';
        ctx.textAlign = 'right';
        
        const marks = [
            { label: '0', pos: 1.0 },
            { label: '-6', pos: 0.8 },
            { label: '-12', pos: 0.5 },
            { label: '-24', pos: 0.25 },
            { label: '-∞', pos: 0 }
        ];
        
        marks.forEach(mark => {
            const y = barTop + barHeight * (1 - mark.pos);
            ctx.fillText(mark.label, barX - 3, y + 3);
            
            // Small tick mark
            ctx.fillRect(barX - 2, y, 2, 1);
        });
    }
    
    /**
     * Draw the active meter with current level
     */
    drawMeter(level, peak) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Clear canvas
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, w, h);
        
        // Draw outline and scale
        this.drawMeterOutline();
        
        // Calculate bar dimensions
        const barX = (w - this.config.barWidth) / 2;
        const barTop = this.config.topPadding;
        const barHeight = h - this.config.topPadding - this.config.bottomPadding;
        
        // Apply minimum sliver
        const displayLevel = Math.max(level, this.config.minSliver);
        const levelHeight = barHeight * displayLevel;
        
        // Draw colored segments from bottom up
        const greenHeight = barHeight * this.config.greenMax;
        const yellowHeight = barHeight * this.config.yellowMax;
        
        // How much of each zone to fill
        const greenFill = Math.min(levelHeight, greenHeight);
        const yellowFill = Math.max(0, Math.min(levelHeight - greenHeight, yellowHeight - greenHeight));
        const redFill = Math.max(0, levelHeight - yellowHeight);
        
        // Draw green zone
        if (greenFill > 0) {
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(barX, barTop + barHeight - greenFill, this.config.barWidth, greenFill);
        }
        
        // Draw yellow zone
        if (yellowFill > 0) {
            ctx.fillStyle = '#eab308';
            ctx.fillRect(barX, barTop + barHeight - greenHeight - yellowFill, this.config.barWidth, yellowFill);
        }
        
        // Draw red zone
        if (redFill > 0) {
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(barX, barTop + barHeight - yellowHeight - redFill, this.config.barWidth, redFill);
        }
        
        // Draw peak hold indicator (white line)
        if (peak > this.config.minSliver) {
            const peakY = barTop + barHeight * (1 - peak);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(barX, peakY - 1, this.config.barWidth, 2);
        }
        
        // Label at top
        ctx.fillStyle = level > 0.1 ? '#22c55e' : '#666';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('AUDIO', w / 2, 14);
    }
    
    /**
     * Destroy the VU meter
     */
    destroy() {
        this.stop();
        console.log('[VU] Destroyed');
    }
}
