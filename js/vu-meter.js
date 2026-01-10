/**
 * VU-METER.JS - Mediahouse Crew Dashboard v3.0
 * Real-time audio meters via WebSocket to FFmpeg analyzer
 * 
 * ARCHITECTURE:
 * Dashboard → WebSocket → audio-ws.mediahouse.com.au → Cloudflare Tunnel
 *          → Container 114 (192.168.30.13:3001) → FFmpeg ebur128 analysis
 * 
 * FEATURES:
 * - Real dB levels (LUFS momentary + True Peak)
 * - Multi-stream support (4 simultaneous meters)
 * - Automatic reconnection
 * - Professional broadcast-style design
 */

class AudioAnalyzerConnection {
    constructor() {
        this.ws = null;
        this.wsUrl = 'wss://audio-ws.mediahouse.com.au';
        this.reconnectDelay = 3000;
        this.listeners = new Map(); // streamId -> callback
        this.streamLevels = {}; // streamId -> levels
        this.isConnected = false;
        
        this.connect();
    }
    
    connect() {
        console.log('[AudioWS] Connecting to', this.wsUrl);
        
        try {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                console.log('[AudioWS] Connected');
                this.isConnected = true;
                this.notifyAll('connected');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'init') {
                        // Initial state with all streams
                        this.streamLevels = data.streams || {};
                        for (const [id, levels] of Object.entries(this.streamLevels)) {
                            this.notifyStream(id, levels);
                        }
                    } else if (data.type === 'levels') {
                        // Level update for specific stream
                        this.streamLevels[data.id] = data.levels;
                        this.notifyStream(data.id, data.levels);
                    } else if (data.type === 'remove') {
                        delete this.streamLevels[data.id];
                        this.notifyStream(data.id, null);
                    }
                } catch (e) {
                    console.error('[AudioWS] Parse error:', e);
                }
            };
            
            this.ws.onclose = () => {
                console.log('[AudioWS] Disconnected, reconnecting in', this.reconnectDelay, 'ms');
                this.isConnected = false;
                this.notifyAll('disconnected');
                setTimeout(() => this.connect(), this.reconnectDelay);
            };
            
            this.ws.onerror = (err) => {
                console.error('[AudioWS] Error:', err);
            };
        } catch (e) {
            console.error('[AudioWS] Connection failed:', e);
            setTimeout(() => this.connect(), this.reconnectDelay);
        }
    }
    
    subscribe(streamId, callback) {
        this.listeners.set(streamId, callback);
        // Send current levels if available
        if (this.streamLevels[streamId]) {
            callback(this.streamLevels[streamId]);
        }
    }
    
    unsubscribe(streamId) {
        this.listeners.delete(streamId);
    }
    
    notifyStream(streamId, levels) {
        const callback = this.listeners.get(streamId);
        if (callback) {
            callback(levels);
        }
    }
    
    notifyAll(status) {
        this.listeners.forEach((callback, streamId) => {
            callback({ status: status });
        });
    }
    
    // Register a stream with the analyzer server
    async registerStream(streamId, hlsUrl) {
        try {
            const response = await fetch('https://audio.mediahouse.com.au/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: streamId, hlsUrl: hlsUrl })
            });
            const data = await response.json();
            console.log('[AudioWS] Registered stream:', streamId, data);
            return data.success;
        } catch (e) {
            console.error('[AudioWS] Failed to register stream:', e);
            return false;
        }
    }
    
    // Remove a stream from the analyzer
    async removeStream(streamId) {
        try {
            const response = await fetch('https://audio.mediahouse.com.au/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: streamId, remove: true })
            });
            const data = await response.json();
            console.log('[AudioWS] Removed stream:', streamId, data);
            return data.success;
        } catch (e) {
            console.error('[AudioWS] Failed to remove stream:', e);
            return false;
        }
    }
}

// Global connection instance
let audioAnalyzer = null;

function getAudioAnalyzer() {
    if (!audioAnalyzer) {
        audioAnalyzer = new AudioAnalyzerConnection();
    }
    return audioAnalyzer;
}

/**
 * VU Meter UI Component
 * Renders broadcast-style dual meters (LUFS + Peak)
 */
class VUMeter {
    constructor(containerElement, streamId) {
        this.container = containerElement;
        this.streamId = streamId;
        this.currentLevels = { momentary: -70, truePeak: -70, status: 'disconnected' };
        this.peakHold = -70;
        this.peakHoldTime = 0;
        this.peakHoldDuration = 2000; // ms
        
        this.render();
        this.startAnimation();
        
        // Subscribe to audio analyzer
        const analyzer = getAudioAnalyzer();
        analyzer.subscribe(streamId, (levels) => this.onLevels(levels));
    }
    
    render() {
        // Safari fix: sync height with video container
        this.syncHeight();
        
        // Re-sync after video loads (Safari timing issue)
        setTimeout(() => this.syncHeight(), 500);
        setTimeout(() => this.syncHeight(), 1500);
        
        this.container.innerHTML = `
            <div class="vu-meters">
                <div class="vu-header">
                    <span class="vu-title">AUDIO</span>
                    <span class="vu-status" data-status="disconnected">●</span>
                </div>
                <div class="vu-meters-row">
                    <div class="vu-meter-col">
                        <div class="vu-label vu-label-lufs">LUFS</div>
                        <div class="vu-track">
                            <div class="vu-scale">
                                <span>0</span><span>-6</span><span>-12</span><span>-18</span><span>-24</span><span>-36</span>
                            </div>
                            <div class="vu-fill vu-fill-lufs" style="height: 0%"></div>
                            <div class="vu-segments"></div>
                        </div>
                        <div class="vu-value vu-value-lufs">--</div>
                    </div>
                    <div class="vu-meter-col">
                        <div class="vu-label vu-label-peak">PEAK</div>
                        <div class="vu-track">
                            <div class="vu-scale">
                                <span>0</span><span>-6</span><span>-12</span><span>-18</span><span>-24</span><span>-36</span>
                            </div>
                            <div class="vu-fill vu-fill-peak" style="height: 0%"></div>
                            <div class="vu-peak-hold" style="bottom: 0%"></div>
                            <div class="vu-segments"></div>
                        </div>
                        <div class="vu-value vu-value-peak">--</div>
                    </div>
                </div>
            </div>
        `;
        
        // Cache DOM references
        this.lufsFill = this.container.querySelector('.vu-fill-lufs');
        this.peakFill = this.container.querySelector('.vu-fill-peak');
        this.peakHoldEl = this.container.querySelector('.vu-peak-hold');
        this.lufsValue = this.container.querySelector('.vu-value-lufs');
        this.peakValue = this.container.querySelector('.vu-value-peak');
        this.statusEl = this.container.querySelector('.vu-status');
    }
    
    onLevels(levels) {
        if (!levels) {
            this.currentLevels = { momentary: -70, truePeak: -70, status: 'removed' };
            return;
        }
        
        if (levels.status === 'connected' || levels.status === 'disconnected') {
            this.currentLevels.status = levels.status;
            return;
        }
        
        this.currentLevels = levels;
        
        // Update peak hold
        if (levels.truePeak > this.peakHold) {
            this.peakHold = levels.truePeak;
            this.peakHoldTime = Date.now();
        }
    }
    
    startAnimation() {
        const animate = () => {
            this.updateDisplay();
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }
    
    updateDisplay() {
        const lufs = this.currentLevels.momentary || -70;
        const peak = this.currentLevels.truePeak || -70;
        const status = this.currentLevels.status || 'disconnected';
        
        // Convert dB to percentage (0 dB = 100%, -36 dB = 0%)
        const lufsPercent = Math.max(0, Math.min(100, ((lufs + 36) / 36) * 100));
        const peakPercent = Math.max(0, Math.min(100, ((peak + 36) / 36) * 100));
        
        // Update fills
        this.lufsFill.style.height = lufsPercent + '%';
        this.peakFill.style.height = peakPercent + '%';
        
        // Update peak hold (decay after hold duration)
        const now = Date.now();
        if (now - this.peakHoldTime > this.peakHoldDuration) {
            this.peakHold = Math.max(peak, this.peakHold - 0.5); // Decay 0.5 dB per frame
        }
        const holdPercent = Math.max(0, Math.min(100, ((this.peakHold + 36) / 36) * 100));
        this.peakHoldEl.style.bottom = holdPercent + '%';
        
        // Update numeric values
        this.lufsValue.textContent = lufs > -60 ? lufs.toFixed(1) : '--';
        this.peakValue.textContent = peak > -60 ? peak.toFixed(1) : '--';
        
        // Update status indicator
        this.statusEl.dataset.status = status;
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        const analyzer = getAudioAnalyzer();
        analyzer.unsubscribe(this.streamId);
    }
    
    // Safari fix: sync VU meter height with video container
    syncHeight() {
        const playerContent = this.container.closest('.player-content');
        const videoContainer = playerContent?.querySelector('.video-container');
        if (videoContainer && videoContainer.offsetHeight > 50) {
            this.container.style.height = videoContainer.offsetHeight + 'px';
            console.log('[VU] Synced height to', videoContainer.offsetHeight, 'px');
        }
    }
    
    // Static method to register stream with analyzer
    static async registerStream(streamId, hlsUrl) {
        const analyzer = getAudioAnalyzer();
        return await analyzer.registerStream(streamId, hlsUrl);
    }
}

// Export for use in app.js
window.VUMeter = VUMeter;
window.getAudioAnalyzer = getAudioAnalyzer;
