/**
 * APP.JS - Mediahouse Crew Dashboard v2.0
 * Main application logic
 * 
 * KEY FIX: Uses manifest pre-fetch to detect LIVE vs VOD
 * - Live streams do NOT have #EXT-X-ENDLIST in manifest
 * - VOD/recordings DO have #EXT-X-ENDLIST
 * 
 * This file orchestrates:
 * - Config loading
 * - Player creation and management
 * - Live stream detection (manifest-based)
 * - View switching (All vs Single player)
 * - Bandwidth control
 * - Stream health indicator (replaces broken VU meters)
 */

let config = null;
let currentView = 'all';
let currentBandwidth = 'medium';
let streamPollers = {}; // Track polling intervals by stream index
let liveStatusPollers = {}; // Track live status polling while playing
let confirmedNotLive = {}; // Track streams confirmed as NOT LIVE via HLS check
let vuMeters = {}; // Track VU meter instances by stream index

/**
 * Initialize the dashboard
 */
async function initDashboard() {
    console.log('[App] Initializing dashboard...');
    
    config = await loadConfig();
    if (!config) {
        showError('Failed to load configuration');
        return;
    }
    
    if (!checkExpiry()) return;
    
    // Initialize settings with config (for password check)
    initSettings(config);
    
    initUI();
    initPlayers();
    
    const prefs = loadPreferences();
    if (prefs) {
        applyPreferences(prefs);
    }
    
    console.log('[App] Dashboard ready');
}

/**
 * Load configuration from API (Netlify Blobs)
 */
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Config not found');
        const config = await response.json();
        
        // CRITICAL: Ensure streamBaseUrl is set
        // Use direct Mux URL (proxy was unreliable)
        if (!config.streamBaseUrl) {
            config.streamBaseUrl = 'https://stream.mux.com/';
            console.log('[App] Using direct Mux URL for streams');
        }
        
        // CRITICAL: Ensure liveStreamId is set for each stream
        // These are needed to check Mux API for live status
        const defaultLiveStreamIds = {
            0: 'spDSZGOT2fRmqVkMpvaiPMjnBD1qW8800ghXCHoJojBc'  // Main Stage
        };
        
        config.streams.forEach((stream, index) => {
            if (!stream.liveStreamId || stream.liveStreamId === 'ENTER_LIVE_STREAM_ID') {
                if (defaultLiveStreamIds[index]) {
                    stream.liveStreamId = defaultLiveStreamIds[index];
                    console.log(`[App] Added missing liveStreamId for stream ${index}`);
                }
            }
        });
        
        return config;
    } catch (error) {
        console.error('[App] Config load failed:', error);
        // Fallback to local config.json for development
        try {
            const fallback = await fetch('/config.json');
            if (fallback.ok) {
                console.log('[App] Using fallback config.json');
                return await fallback.json();
            }
        } catch (e) {
            console.error('[App] Fallback config also failed');
        }
        return null;
    }
}

/**
 * Show error message
 */
function showError(message) {
    document.body.innerHTML = `
        <div class="error-message">
            <h1>⚠️ Error</h1>
            <p>${message}</p>
            <p style="color: #666; margin-top: 20px;">Please refresh or contact the producer.</p>
        </div>
    `;
}

/**
 * Check if dashboard has expired
 */
function checkExpiry() {
    const now = new Date();
    const expiry = new Date(config.expiryDate);
    
    if (now > expiry) {
        document.body.innerHTML = `
            <div class="expired-message">
                <h1>Event Ended</h1>
                <p>${config.eventName} has concluded.</p>
                <p>Thank you for being part of the crew!</p>
            </div>
        `;
        return false;
    }
    return true;
}

/**
 * Initialize UI elements
 */
function initUI() {
    const titleEl = document.getElementById('eventTitle');
    if (titleEl) titleEl.textContent = config.eventName;
    
    createPlayerSelector();
    createVisibilityToggles();
    setBandwidth(config.defaultBandwidth || 'medium');
    populateEventInfo();
}

/**
 * Create player selector buttons
 */
function createPlayerSelector() {
    const selector = document.getElementById('playerSelector');
    if (!selector) return;
    
    let html = `<button class="selector-btn active" data-view="all" onclick="switchView('all')">All</button>`;
    
    config.streams.forEach((stream, index) => {
        html += `<button class="selector-btn" data-view="${index}" onclick="switchView(${index})">${stream.name}</button>`;
    });
    
    selector.innerHTML = html;
}

/**
 * Create visibility toggle buttons
 */
function createVisibilityToggles() {
    const toggles = document.getElementById('visibilityToggles');
    if (!toggles) return;
    
    const labels = {
        streamHealth: 'Health',
        duration: 'Duration',
        bitrate: 'Bitrate',
        viewers: 'Viewers'
    };
    
    let html = '<span class="toggle-label">SHOW:</span>';
    
    const visibilitySettings = config.visibility || {};
    Object.keys(labels).forEach(key => {
        const checked = visibilitySettings[key] !== false ? 'checked' : '';
        html += `
            <label class="toggle-item">
                <input type="checkbox" id="toggle-${key}" ${checked} onchange="toggleVisibility('${key}', this.checked)">
                <span>${labels[key]}</span>
            </label>
        `;
    });
    
    toggles.innerHTML = html;
}

/**
 * Toggle visibility of UI elements
 */
function toggleVisibility(key, visible) {
    const container = document.getElementById('playerContainer');
    if (!container) return;
    
    if (visible) {
        container.classList.remove(`hide-${key}`);
    } else {
        container.classList.add(`hide-${key}`);
    }
    
    savePreferences();
}

/**
 * Populate event info in the info tab
 */
function populateEventInfo() {
    const infoContainer = document.getElementById('eventInfo');
    if (!infoContainer || !config) return;
    
    const eventInfo = config.eventInfo || {};
    
    infoContainer.innerHTML = `
        <div class="info-row">
            <span class="info-label">Event</span>
            <span class="info-value">${config.eventName || 'Not set'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Date</span>
            <span class="info-value">${eventInfo.date || 'Not set'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Call Time</span>
            <span class="info-value">${eventInfo.callTime || 'Not set'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Live</span>
            <span class="info-value">${eventInfo.liveStart || ''} - ${eventInfo.liveEnd || ''}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Producer</span>
            <span class="info-value">${eventInfo.producerName || 'Not set'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Phone</span>
            <span class="info-value">${eventInfo.producerPhone || 'Not set'}</span>
        </div>
        <div class="info-row info-brief">
            <span class="info-label">Brief</span>
            <span class="info-value">${eventInfo.brief || ''}</span>
        </div>
    `;
    
    if (eventInfo.whatsappLink) {
        infoContainer.innerHTML += `
            <a href="${eventInfo.whatsappLink}" class="whatsapp-btn" target="_blank">
                📱 Message Producer on WhatsApp
            </a>
        `;
    }
}

/**
 * Initialize players for all streams
 */
function initPlayers() {
    const container = document.getElementById('playerContainer');
    if (!container) return;
    
    container.innerHTML = ''; // Clear existing
    
    config.streams.forEach((stream, index) => {
        const playerWrapper = createPlayerWrapper(stream, index);
        container.appendChild(playerWrapper);
    });
    
    switchView('all');
}

/**
 * CRITICAL: Check if a stream is LIVE using Mux API
 * 
 * This calls our Netlify function which checks Mux API directly.
 * - status: "active" = encoder is streaming = LIVE
 * - status: "idle" = encoder stopped = NOT LIVE (don't play recording)
 */
async function checkStreamStatus(liveStreamId) {
    if (!liveStreamId || liveStreamId === 'ENTER_LIVE_STREAM_ID') {
        console.log(`[App] No Live Stream ID configured - returning NOT LIVE`);
        return { isLive: false, error: 'No Live Stream ID configured' };
    }
    
    try {
        const response = await fetch(`/api/stream-status?liveStreamId=${liveStreamId}`, {
            method: 'GET',
            cache: 'no-cache',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
            console.log(`[App] Stream status API failed: ${response.status} - assuming NOT LIVE`);
            return { isLive: false, error: `HTTP ${response.status}` };
        }
        
        const data = await response.json();
        
        // STRICT CHECK: Only "active" status means encoder is actually streaming
        const isLive = data.status === 'active';
        
        // Get playbackId from API response (first one)
        const playbackId = data.playbackIds && data.playbackIds.length > 0 ? data.playbackIds[0] : null;
        
        console.log(`[App] Mux API: Stream ${liveStreamId.substring(0,8)}... status: "${data.status}", isLive: ${isLive}, playbackId: ${playbackId ? playbackId.substring(0,8)+'...' : 'none'}`);
        
        return { 
            isLive: isLive, 
            status: data.status,
            playbackId: playbackId,
            error: null 
        };
        
    } catch (error) {
        console.error(`[App] Stream status check failed:`, error);
        console.log(`[App] Network error - assuming NOT LIVE for safety`);
        return { isLive: false, error: error.message };
    }
}

/**
 * Create a player wrapper with video and health indicator
 */
function createPlayerWrapper(stream, index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'player-wrapper';
    wrapper.id = `player-${index}`;
    wrapper.dataset.index = index;
    
    wrapper.innerHTML = `
        <div class="player-header">
            <span class="stream-name">${stream.name}</span>
            <span class="stream-status" id="status-${index}">⏳ Checking...</span>
        </div>
        <div class="player-content">
            <div class="video-container">
                <video
                    id="video-${index}"
                    crossorigin="anonymous"
                    muted
                    playsinline
                    poster="images/poster.jpg"
                ></video>
                <div class="video-overlay" id="overlay-${index}">
                    <div class="overlay-message">⏹ Not Live</div>
                </div>
            </div>
            <div class="vu-container" id="vu-container-${index}"></div>
        </div>
        <div class="player-stats">
            <span class="stat stat-duration" id="duration-${index}">⏱ --:--:--</span>
            <span class="stat stat-bitrate" id="bitrate-${index}">📡 -- Mbps</span>
            <span class="stat stat-viewers" id="viewers-${index}">👁 --</span>
        </div>
    `;
    
    // Initialize this stream after DOM insertion
    // Pass both liveStreamId (for status check) and playbackId (for video)
    setTimeout(() => initStreamPlayer(index, stream.liveStreamId, stream.playbackId), 100);
    
    return wrapper;
}

/**
 * Initialize a stream player with live detection
 * @param {number} index - Stream index
 * @param {string} liveStreamId - Mux Live Stream ID (for API status check)
 * @param {string} playbackId - Mux Playback ID (for video URL)
 */
async function initStreamPlayer(index, liveStreamId, playbackId) {
    const video = document.getElementById(`video-${index}`);
    const statusEl = document.getElementById(`status-${index}`);
    const overlayEl = document.getElementById(`overlay-${index}`);
    
    if (!video) {
        console.error(`[App] Video element not found for index ${index}`);
        return;
    }
    
    // Store state on video element
    video.hlsInstance = null;
    video.isLive = false;
    video.playbackId = playbackId;
    video.liveStreamId = liveStreamId;
    
    // Check if stream is actually LIVE using Mux API
    statusEl.textContent = '⏳ Checking...';
    const status = await checkStreamStatus(liveStreamId);
    
    // Use playbackId from API if config doesn't have one
    const actualPlaybackId = playbackId || status.playbackId;
    video.playbackId = actualPlaybackId;
    
    if (!status.isLive) {
        console.log(`[App] Stream ${index} is NOT live (status: ${status.status}) - showing poster`);
        statusEl.textContent = '⏹ Not Live';
        statusEl.className = 'stream-status';
        overlayEl.style.display = 'flex';
        
        // Start polling for when stream goes live
        startStreamPoller(index, liveStreamId, actualPlaybackId);
        return;
    }
    
    // Stream IS live - load it
    console.log(`[App] Stream ${index} IS LIVE - loading player with playbackId: ${actualPlaybackId}`);
    video.isLive = true;
    overlayEl.style.display = 'none';
    loadHlsPlayer(index, actualPlaybackId);
}

/**
 * Load HLS.js player for a stream
 */
function loadHlsPlayer(index, playbackId) {
    const video = document.getElementById(`video-${index}`);
    const statusEl = document.getElementById(`status-${index}`);
    const overlayEl = document.getElementById(`overlay-${index}`);
    
    console.log(`[App] loadHlsPlayer called for index ${index}, playbackId: ${playbackId}`);
    
    if (!video) {
        console.error(`[App] CRITICAL: Video element not found for index ${index}`);
        return;
    }
    
    // Set up video event handlers EARLY so we capture all events
    setupVideoEvents(index);
    
    // Log HLS.js availability
    console.log(`[App] HLS.js available: ${typeof Hls !== 'undefined'}, supported: ${typeof Hls !== 'undefined' ? Hls.isSupported() : 'N/A'}`);
    if (typeof Hls !== 'undefined') {
        console.log(`[App] HLS.js version: ${Hls.version}`);
    }
    
    // Destroy existing HLS instance if any
    if (video.hlsInstance) {
        console.log(`[App] Destroying existing HLS instance for stream ${index}`);
        video.hlsInstance.destroy();
        video.hlsInstance = null;
    }
    
    // ALWAYS use direct Mux URL - proxy causes CORS errors
    const streamUrl = `https://stream.mux.com/${playbackId}.m3u8`;
    console.log(`[App] Stream URL: ${streamUrl}`);
    
    // Check for HLS.js support
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        console.log(`[App] Creating HLS.js instance for stream ${index}`);
        
        const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 30,
            debug: false
        });
        
        hls.loadSource(streamUrl);
        console.log(`[App] HLS source loaded: ${streamUrl}`);
        
        hls.attachMedia(video);
        console.log(`[App] HLS attached to video element`);
        
        // Track MEDIA_ATTACHED event
        hls.on(Hls.Events.MEDIA_ATTACHED, function() {
            console.log(`[App] Stream ${index}: MEDIA_ATTACHED event fired`);
        });
        
        hls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
            console.log(`[App] Stream ${index}: MANIFEST_PARSED event fired`);
            console.log(`[App] Manifest has ${data.levels.length} quality levels`);
            console.log(`[App] Video readyState: ${video.readyState}, paused: ${video.paused}`);
            
            // DON'T auto-play yet - wait for LEVEL_LOADED to confirm it's actually live
            // This prevents playing recordings that sneak through
            console.log(`[App] Stream ${index}: Waiting for LEVEL_LOADED to confirm live status before playing...`);
        });
        
        hls.on(Hls.Events.LEVEL_LOADED, function(event, data) {
            // CRITICAL: Check if stream is actually LIVE or VOD/recording
            const isActuallyLive = data.details && data.details.live === true;
            
            console.log(`[App] Stream ${index}: LEVEL_LOADED - isLive: ${isActuallyLive}`);
            
            if (!isActuallyLive) {
                // This is a VOD/recording - STOP IMMEDIATELY
                console.log(`[App] Stream ${index}: DETECTED VOD/RECORDING - STOPPING AND BLOCKING`);
                confirmedNotLive[index] = true; // Block future attempts until real live detected
                video.pause();
                hls.destroy();
                video.hlsInstance = null;
                handleStreamEnded(index);
                return;
            }
            
            // Confirmed LIVE - clear the block flag
            confirmedNotLive[index] = false;
            
            // Confirmed LIVE - now play
            console.log(`[App] Stream ${index}: CONFIRMED LIVE - starting playback`);
            video.play()
                .then(() => console.log(`[App] Stream ${index}: ✅ PLAYING LIVE STREAM`))
                .catch(e => console.error(`[App] Stream ${index}: Play failed:`, e.name));
            
            // Update bitrate display
            const bitrate = Math.round(hls.levels[hls.currentLevel]?.bitrate / 1000000 * 10) / 10 || 0;
            const bitrateEl = document.getElementById(`bitrate-${index}`);
            if (bitrateEl) bitrateEl.textContent = `📡 ${bitrate} Mbps`;
        });
        
        hls.on(Hls.Events.ERROR, function(event, data) {
            console.error(`[App] Stream ${index} HLS error:`, data.type, data.details);
            
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        // Try to recover
                        console.log('[App] Attempting network recovery...');
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log('[App] Attempting media recovery...');
                        hls.recoverMediaError();
                        break;
                    default:
                        // Cannot recover - mark as not live
                        console.error('[App] Fatal error, cannot recover');
                        handleStreamEnded(index);
                        break;
                }
            }
        });
        
        video.hlsInstance = hls;
        
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        console.log(`[App] Using native HLS for stream ${index}`);
        video.src = streamUrl;
        video.play().catch(e => console.log('[App] Safari autoplay blocked:', e));
    } else {
        console.error('[App] HLS not supported');
        statusEl.textContent = '❌ Not Supported';
        return;
    }
    
    // Update status
    statusEl.textContent = '🟢 LIVE';
    statusEl.className = 'stream-status live';
    overlayEl.style.display = 'none';
    
    // Start continuous status polling to detect when encoder stops
    startLiveStatusPoller(index, video.liveStreamId);
    
    // Initialize VU meter (auto-starts when video plays)
    setupVuMeter(index);
}

/**
 * Set up video element event handlers
 */
function setupVideoEvents(index) {
    const video = document.getElementById(`video-${index}`);
    if (!video) return;
    
    console.log(`[App] Setting up video events for stream ${index}`);
    
    // Key playback state events
    video.addEventListener('loadstart', () => console.log(`[App] Stream ${index}: loadstart`));
    video.addEventListener('loadeddata', () => console.log(`[App] Stream ${index}: loadeddata - readyState: ${video.readyState}`));
    video.addEventListener('canplay', () => console.log(`[App] Stream ${index}: canplay - ready to play`));
    video.addEventListener('canplaythrough', () => console.log(`[App] Stream ${index}: canplaythrough`));
    video.addEventListener('playing', () => console.log(`[App] Stream ${index}: ✅ PLAYING event - video is actually playing now!`));
    video.addEventListener('pause', () => console.log(`[App] Stream ${index}: paused`));
    video.addEventListener('waiting', () => console.log(`[App] Stream ${index}: waiting for data...`));
    video.addEventListener('stalled', () => console.log(`[App] Stream ${index}: stalled - network issue`));
    
    // Track duration
    let durationInterval = setInterval(() => {
        if (!video.paused && !video.ended) {
            const duration = Math.floor(video.currentTime);
            const hours = Math.floor(duration / 3600);
            const mins = Math.floor((duration % 3600) / 60);
            const secs = duration % 60;
            const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            const durationEl = document.getElementById(`duration-${index}`);
            if (durationEl) durationEl.textContent = `⏱ ${timeStr}`;
        }
    }, 1000);
    
    // Store interval for cleanup
    video.durationInterval = durationInterval;
    
    // Handle video ending
    video.addEventListener('ended', () => {
        console.log(`[App] Stream ${index}: Video ended`);
        handleStreamEnded(index);
    });
    
    // Handle video errors
    video.addEventListener('error', (e) => {
        console.error(`[App] Stream ${index}: Video error`, e);
    });
    
    // VU meter handles its own animation state based on audio data
}

/**
 * Handle stream ending - show offline state and start polling
 */
function handleStreamEnded(index) {
    const video = document.getElementById(`video-${index}`);
    const statusEl = document.getElementById(`status-${index}`);
    const overlayEl = document.getElementById(`overlay-${index}`);
    
    console.log(`[App] handleStreamEnded called for stream ${index}`);
    
    // Stop live status polling
    stopLiveStatusPoller(index);
    
    // Destroy HLS instance
    if (video && video.hlsInstance) {
        video.hlsInstance.destroy();
        video.hlsInstance = null;
    }
    
    // Clear duration interval
    if (video && video.durationInterval) {
        clearInterval(video.durationInterval);
    }
    
    // Stop VU meter
    stopVuMeter(index);
    
    // Update UI
    if (statusEl) {
        statusEl.textContent = '⏹ Not Live';
        statusEl.className = 'stream-status';
    }
    if (overlayEl) overlayEl.style.display = 'flex';
    
    // Start polling for stream to come back (get IDs from video element)
    if (video && video.liveStreamId && video.playbackId) {
        startStreamPoller(index, video.liveStreamId, video.playbackId);
    }
}

/**
 * Start polling for a stream to go live
 * @param {number} index - Stream index
 * @param {string} liveStreamId - Mux Live Stream ID (for API status check)
 * @param {string} playbackId - Mux Playback ID (for video URL)
 */
function startStreamPoller(index, liveStreamId, playbackId) {
    // Clear existing poller
    if (streamPollers[index]) {
        clearInterval(streamPollers[index]);
    }
    
    console.log(`[App] Starting poller for stream ${index} (checking every 10s)`);
    
    // Poll every 10 seconds using Mux API
    streamPollers[index] = setInterval(async () => {
        const status = await checkStreamStatus(liveStreamId);
        
        // If API says idle/not-active, clear the block flag (reconnect window ended)
        if (!status.isLive) {
            if (confirmedNotLive[index]) {
                console.log(`[App] Stream ${index}: API now says IDLE - clearing block flag`);
                confirmedNotLive[index] = false;
            }
            return; // Stay in polling mode
        }
        
        // API says active - but is it really live or just reconnect window?
        if (confirmedNotLive[index]) {
            console.log(`[App] Stream ${index}: API says active but blocked - likely reconnect window`);
            return;
        }
        
        // Try to load - HLS LEVEL_LOADED will verify if really live
        console.log(`[App] Stream ${index} API says LIVE - attempting to load player`);
        clearInterval(streamPollers[index]);
        delete streamPollers[index];
        
        const video = document.getElementById(`video-${index}`);
        if (video) {
            video.isLive = true;
            const overlayEl = document.getElementById(`overlay-${index}`);
            if (overlayEl) overlayEl.style.display = 'none';
            loadHlsPlayer(index, playbackId);
        }
    }, 10000); // 10 seconds
}

/**
 * Poll Mux API while stream is playing to detect when encoder stops
 * @param {number} index - Stream index
 * @param {string} liveStreamId - Mux Live Stream ID
 */
function startLiveStatusPoller(index, liveStreamId) {
    // Clear existing poller
    if (liveStatusPollers[index]) {
        clearInterval(liveStatusPollers[index]);
    }
    
    console.log(`[App] Starting LIVE status poller for stream ${index} (checking every 5s)`);
    
    // Poll every 5 seconds to detect when encoder stops
    liveStatusPollers[index] = setInterval(async () => {
        const status = await checkStreamStatus(liveStreamId);
        
        if (!status.isLive) {
            console.log(`[App] Stream ${index} encoder STOPPED - ending playback`);
            clearInterval(liveStatusPollers[index]);
            delete liveStatusPollers[index];
            handleStreamEnded(index);
        }
    }, 5000); // 5 seconds
}

/**
 * Stop live status polling for a stream
 */
function stopLiveStatusPoller(index) {
    if (liveStatusPollers[index]) {
        clearInterval(liveStatusPollers[index]);
        delete liveStatusPollers[index];
        console.log(`[App] Stopped live status poller for stream ${index}`);
    }
}

/**
 * Initialize VU meter for a stream
 * NEW: Uses WebSocket connection to server-side FFmpeg analyzer
 */
function setupVuMeter(index) {
    const video = document.getElementById(`video-${index}`);
    const container = document.getElementById(`vu-container-${index}`);
    
    if (!video || !container) {
        console.error(`[VU] Missing elements for stream ${index}`);
        return;
    }
    
    // Get stream config for HLS URL
    const stream = config?.streams?.[index];
    if (!stream || !stream.playbackId) {
        console.error(`[VU] No stream config for index ${index}`);
        return;
    }
    
    const hlsUrl = `https://stream.mux.com/${stream.playbackId}.m3u8`;
    const streamId = `stream-${index}`;
    
    // Destroy existing VU meter if any
    if (vuMeters[index]) {
        vuMeters[index].destroy();
        delete vuMeters[index];
    }
    
    // Create new VU meter instance
    vuMeters[index] = new VUMeter(container, streamId);
    console.log(`[VU] Created VU meter for stream ${index}`);
    
    // Register stream with audio analyzer server
    VUMeter.registerStream(streamId, hlsUrl)
        .then(success => {
            if (success) {
                console.log(`[VU] Registered stream ${index} with analyzer`);
            } else {
                console.warn(`[VU] Failed to register stream ${index}`);
            }
        })
        .catch(e => console.error(`[VU] Registration error:`, e));
}

/**
 * Stop VU meter for a stream
 */
function stopVuMeter(index) {
    if (vuMeters[index]) {
        const streamId = `stream-${index}`;
        vuMeters[index].destroy();
        delete vuMeters[index];
        
        // Remove stream from analyzer server
        const analyzer = window.getAudioAnalyzer ? window.getAudioAnalyzer() : null;
        if (analyzer) {
            analyzer.removeStream(streamId)
                .catch(e => console.warn(`[VU] Failed to remove stream ${index}:`, e));
        }
        
        console.log(`[VU] Stopped VU meter for stream ${index}`);
    }
}

/**
 * Switch view between all players and single player
 */
function switchView(view) {
    currentView = view;
    const container = document.getElementById('playerContainer');
    if (!container) return;
    
    // Update selector buttons
    document.querySelectorAll('.selector-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === String(view)) {
            btn.classList.add('active');
        }
    });
    
    if (view === 'all') {
        // Show all players in grid
        container.className = 'grid-view';
        document.querySelectorAll('.player-wrapper').forEach(wrapper => {
            wrapper.style.display = 'block';
        });
    } else {
        // Show single player
        container.className = 'single-view';
        document.querySelectorAll('.player-wrapper').forEach((wrapper, index) => {
            wrapper.style.display = index === view ? 'block' : 'none';
        });
    }
}

/**
 * Set bandwidth mode
 */
function setBandwidth(level) {
    currentBandwidth = level;
    
    // Update UI
    document.querySelectorAll('.bandwidth-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.bandwidth === level) {
            btn.classList.add('active');
        }
    });
    
    // Apply to all HLS instances
    document.querySelectorAll('video').forEach(video => {
        if (video.hlsInstance) {
            const hls = video.hlsInstance;
            switch (level) {
                case 'low':
                    hls.currentLevel = 0;
                    hls.autoLevelEnabled = false;
                    break;
                case 'high':
                    hls.currentLevel = hls.levels.length - 1;
                    hls.autoLevelEnabled = false;
                    break;
                default: // medium = auto
                    hls.autoLevelEnabled = true;
                    break;
            }
        }
    });
    
    savePreferences();
}

/**
 * Save user preferences to localStorage
 */
function savePreferences() {
    const prefs = {
        bandwidth: currentBandwidth,
        visibility: {}
    };
    
    // Save visibility toggles
    document.querySelectorAll('[id^="toggle-"]').forEach(toggle => {
        const key = toggle.id.replace('toggle-', '');
        prefs.visibility[key] = toggle.checked;
    });
    
    localStorage.setItem('dashboardPrefs', JSON.stringify(prefs));
}

/**
 * Load user preferences from localStorage
 */
function loadPreferences() {
    try {
        const saved = localStorage.getItem('dashboardPrefs');
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
}

/**
 * Apply loaded preferences
 */
function applyPreferences(prefs) {
    if (prefs.bandwidth) {
        setBandwidth(prefs.bandwidth);
    }
    
    if (prefs.visibility) {
        Object.keys(prefs.visibility).forEach(key => {
            const toggle = document.getElementById(`toggle-${key}`);
            if (toggle) {
                toggle.checked = prefs.visibility[key];
                toggleVisibility(key, prefs.visibility[key]);
            }
        });
    }
}

// ============================================
// BREAK MODE SYSTEM
// ============================================

let breakModeState = {}; // Current break mode for each stream
let breakModePoller = null; // Global poller for break mode
const FALLBACK_PLAYBACK_ID = 'mbX0201BRcVnkh802Fb00UHWbRUpNgV64lM029iBmuHLqe1g';

/**
 * Start polling for break mode state (runs continuously)
 */
function startBreakModePoller() {
    if (breakModePoller) return; // Already running
    
    console.log('[App] Starting break mode poller (every 5s)');
    
    // Initial fetch
    fetchBreakModeState();
    
    // Poll every 5 seconds
    breakModePoller = setInterval(fetchBreakModeState, 5000);
}

/**
 * Fetch break mode state from server and apply changes
 */
async function fetchBreakModeState() {
    try {
        const response = await fetch('/api/break-mode', {
            method: 'GET',
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
            console.warn('[App] Break mode API unavailable');
            return;
        }
        
        const data = await response.json();
        
        if (data.success && data.breakMode) {
            const newState = data.breakMode;
            
            // Check each stream for changes
            for (let i = 0; i < 4; i++) {
                const index = String(i);
                const wasOnBreak = breakModeState[index] === true;
                const isOnBreak = newState[index] === true;
                
                if (wasOnBreak !== isOnBreak) {
                    console.log(`[App] Stream ${i} break mode changed: ${wasOnBreak} -> ${isOnBreak}`);
                    applyBreakModeToStream(i, isOnBreak, newState.fallbackPlaybackId || FALLBACK_PLAYBACK_ID);
                }
            }
            
            // Update local state
            breakModeState = newState;
        }
    } catch (error) {
        console.error('[App] Break mode fetch error:', error);
    }
}

/**
 * Apply break mode to a specific stream
 * @param {number} index - Stream index
 * @param {boolean} isOnBreak - Whether stream should be on break
 * @param {string} fallbackId - Playback ID for fallback video
 */
function applyBreakModeToStream(index, isOnBreak, fallbackId) {
    const video = document.getElementById(`video-${index}`);
    const statusEl = document.getElementById(`status-${index}`);
    const overlayEl = document.getElementById(`overlay-${index}`);
    const wrapper = document.getElementById(`player-${index}`);
    
    if (!video) {
        console.error(`[App] Cannot apply break mode - video element ${index} not found`);
        return;
    }
    
    if (isOnBreak) {
        // === SWITCHING TO BREAK MODE ===
        console.log(`[App] Stream ${index}: GOING TO BREAK - loading fallback video`);
        
        // Stop any existing pollers for this stream
        stopLiveStatusPoller(index);
        if (streamPollers[index]) {
            clearInterval(streamPollers[index]);
            delete streamPollers[index];
        }
        
        // Destroy existing HLS instance
        if (video.hlsInstance) {
            video.hlsInstance.destroy();
            video.hlsInstance = null;
        }
        
        // Stop VU meter
        stopVuMeter(index);
        
        // Update UI to show break status
        if (statusEl) {
            statusEl.textContent = '🔴 ON BREAK';
            statusEl.className = 'stream-status break';
        }
        if (overlayEl) overlayEl.style.display = 'none';
        if (wrapper) wrapper.classList.add('on-break');
        
        // Load fallback video (loops)
        loadFallbackVideo(index, fallbackId);
        
    } else {
        // === RETURNING TO LIVE ===
        console.log(`[App] Stream ${index}: GOING LIVE - attempting to load live stream`);
        
        // Stop fallback video
        if (video.hlsInstance) {
            video.hlsInstance.destroy();
            video.hlsInstance = null;
        }
        
        // Clear break flag
        confirmedNotLive[index] = false;
        
        // Remove break styling
        if (wrapper) wrapper.classList.remove('on-break');
        
        // Update status to checking
        if (statusEl) {
            statusEl.textContent = '⏳ Checking...';
            statusEl.className = 'stream-status';
        }
        
        // Get stream config
        const stream = config?.streams?.[index];
        if (stream) {
            // Re-initialize the stream (will check if actually live)
            initStreamPlayer(index, stream.liveStreamId, stream.playbackId);
        }
    }
}

/**
 * Load fallback/holding video for a stream
 * @param {number} index - Stream index
 * @param {string} playbackId - Mux Playback ID for fallback video
 */
function loadFallbackVideo(index, playbackId) {
    const video = document.getElementById(`video-${index}`);
    
    if (!video) return;
    
    const fallbackUrl = `https://stream.mux.com/${playbackId}.m3u8`;
    console.log(`[App] Loading fallback video for stream ${index}: ${fallbackUrl}`);
    
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = new Hls({
            enableWorker: true,
            debug: false
        });
        
        hls.loadSource(fallbackUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            console.log(`[App] Stream ${index}: Fallback video manifest loaded`);
            video.loop = true; // Loop the fallback video
            video.play()
                .then(() => console.log(`[App] Stream ${index}: Fallback video playing`))
                .catch(e => console.error(`[App] Stream ${index}: Fallback play failed:`, e));
        });
        
        hls.on(Hls.Events.ERROR, function(event, data) {
            console.error(`[App] Stream ${index}: Fallback video error:`, data.details);
        });
        
        video.hlsInstance = hls;
        
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = fallbackUrl;
        video.loop = true;
        video.play().catch(e => console.log('[App] Safari fallback autoplay blocked'));
    }
}

/**
 * Handle break mode change from settings.js button click
 * This provides immediate feedback without waiting for poller
 * @param {number} streamIndex - Stream index
 * @param {boolean} isOnBreak - New break state
 * @param {string} fallbackId - Fallback video playback ID
 */
function handleBreakModeChange(streamIndex, isOnBreak, fallbackId) {
    console.log(`[App] handleBreakModeChange called: stream ${streamIndex}, break: ${isOnBreak}`);
    
    // Update local state immediately
    breakModeState[String(streamIndex)] = isOnBreak;
    
    // Apply the change immediately (don't wait for poller)
    applyBreakModeToStream(streamIndex, isOnBreak, fallbackId || FALLBACK_PLAYBACK_ID);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    
    // Start break mode polling after dashboard loads
    setTimeout(startBreakModePoller, 2000);
});
