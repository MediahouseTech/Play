/**
 * SETTINGS.JS - Mediahouse Crew Dashboard
 * Settings modal for producer access
 * 
 * PASSWORD: Live2Stream (configurable in config.json)
 * 
 * FEATURES:
 * - Stream configuration (Playback IDs, Stream Keys, RTMP)
 * - Copy buttons for all credentials
 * - Event info editing
 * - Visibility controls
 * - Expiry date setting
 * - SMS share
 */

let settingsConfig = null;
let isProducerAuthenticated = false;

const AUTH_SESSION_KEY = 'producerAuth';

/**
 * Initialize settings module
 */
function initSettings(config) {
    settingsConfig = config;
    console.log('[Settings] Initialized with config');
    
    // Check for existing session authentication
    checkExistingSession();
}

/**
 * Check if user is already authenticated from previous page visit
 */
function checkExistingSession() {
    if (sessionStorage.getItem(AUTH_SESSION_KEY) === 'true') {
        console.log('[Settings] Found existing session, restoring producer access');
        isProducerAuthenticated = true;
        
        // Show producer UI elements
        showBreakModePanel();
        
        // Show Recordings tab
        const recordingsTabBtn = document.getElementById('recordingsTabBtn');
        const recordingsDivider = document.getElementById('recordingsDivider');
        if (recordingsTabBtn) recordingsTabBtn.style.display = 'inline-flex';
        if (recordingsDivider) recordingsDivider.style.display = 'block';
    }
}

/**
 * Open settings - triggers password modal first
 */
function openSettings() {
    const passwordModal = document.getElementById('passwordModal');
    if (isProducerAuthenticated) {
        // Already authenticated, show settings directly
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) settingsModal.classList.add('show');
        populateSettings();
    } else {
        // Show password modal
        if (passwordModal) passwordModal.classList.add('show');
        document.getElementById('passwordInput')?.focus();
    }
}

/**
 * Close settings modal
 */
function closeSettings() {
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) settingsModal.classList.remove('show');
}

/**
 * Close password modal
 */
function closePasswordModal() {
    const passwordModal = document.getElementById('passwordModal');
    if (passwordModal) passwordModal.classList.remove('show');
    document.getElementById('passwordInput').value = '';
    document.getElementById('passwordError').classList.remove('show');
}

/**
 * Check password and proceed to settings
 */
function checkPassword() {
    const input = document.getElementById('passwordInput');
    const error = document.getElementById('passwordError');
    
    if (input.value === settingsConfig.producerPassword) {
        isProducerAuthenticated = true;
        sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
        closePasswordModal();
        
        // Show break mode panel on main dashboard
        showBreakModePanel();
        
        // Show Recordings tab
        const recordingsTabBtn = document.getElementById('recordingsTabBtn');
        const recordingsDivider = document.getElementById('recordingsDivider');
        if (recordingsTabBtn) recordingsTabBtn.style.display = 'inline-flex';
        if (recordingsDivider) recordingsDivider.style.display = 'block';
        
        // Show settings modal
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) settingsModal.classList.add('show');
        populateSettings();
    } else {
        error.classList.add('show');
        input.value = '';
        input.focus();
    }
}

/**
 * Show break mode panel on main dashboard (after producer login)
 */
function showBreakModePanel() {
    // Now uses inline controls in each player's stats bar
    if (typeof showInlineBreakControls === 'function') {
        showInlineBreakControls();
        console.log('[Settings] Inline break controls shown on dashboard');
        
        // Retry after a short delay in case players are still being created
        setTimeout(() => {
            if (typeof showInlineBreakControls === 'function') {
                showInlineBreakControls();
            }
        }, 500);
    }
}

/**
 * Populate main dashboard break mode controls
 */
async function populateMainBreakControls() {
    const container = document.getElementById('breakModeControlsMain');
    if (!container || !settingsConfig?.streams) return;
    
    // Fetch latest state
    await fetchBreakModeState();
    
    // Use cache or empty defaults
    const state = settingsBreakModeCache || { "0": false, "1": false, "2": false, "3": false };
    
    container.innerHTML = settingsConfig.streams.map((stream, index) => {
        const isOnBreak = state[String(index)] === true;
        return `
            <div class="break-control-card ${isOnBreak ? 'on-break' : ''}" data-stream-index="${index}">
                <div class="break-control-info">
                    <span class="break-control-name">${stream.name}</span>
                    <span class="break-control-status ${isOnBreak ? 'break' : 'live'}">
                        ${isOnBreak ? 'BREAK' : 'LIVE'}
                    </span>
                </div>
                <button 
                    class="btn-break-main ${isOnBreak ? 'go-live' : 'go-break'}" 
                    onclick="toggleBreakModeMain(${index}, ${!isOnBreak})"
                >
                    ${isOnBreak ? 'GO LIVE' : 'BREAK'}
                </button>
            </div>
        `;
    }).join('');
}

/**
 * Toggle break mode from main dashboard
 */
async function toggleBreakModeMain(streamIndex, setToBreak) {
    const card = document.querySelector(`.break-control-card[data-stream-index="${streamIndex}"]`);
    const button = card?.querySelector('.btn-break-main');
    
    if (button) {
        button.disabled = true;
        button.textContent = '...';
    }
    
    try {
        const response = await fetch('/api/break-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                streamIndex: streamIndex,
                isOnBreak: setToBreak,
                updatedBy: 'producer'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update local cache
            settingsBreakModeCache = data.breakMode;
            
            // Update main dashboard card
            if (card) {
                card.className = `break-control-card ${setToBreak ? 'on-break' : ''}`;
                card.dataset.streamIndex = streamIndex;
            }
            
            const status = card?.querySelector('.break-control-status');
            if (status) {
                status.className = `break-control-status ${setToBreak ? 'break' : 'live'}`;
                status.textContent = setToBreak ? 'BREAK' : 'LIVE';
            }
            
            if (button) {
                button.className = `btn-break-main ${setToBreak ? 'go-live' : 'go-break'}`;
                button.textContent = setToBreak ? 'GO LIVE' : 'BREAK';
                button.onclick = () => toggleBreakModeMain(streamIndex, !setToBreak);
            }
            
            console.log(`[Settings] Stream ${streamIndex} set to ${setToBreak ? 'BREAK' : 'LIVE'}`);
            
            // Notify app.js to update players immediately
            if (typeof handleBreakModeChange === 'function') {
                handleBreakModeChange(streamIndex, setToBreak, settingsBreakModeCache?.fallbackPlaybackId);
            }
        } else {
            throw new Error(data.error || 'Unknown error');
        }
        
    } catch (error) {
        console.error('[Settings] Break mode toggle failed:', error);
        alert('Failed to update break mode: ' + error.message);
        
        // Reset button
        if (button) {
            button.textContent = setToBreak ? 'BREAK' : 'GO LIVE';
        }
    } finally {
        if (button) button.disabled = false;
    }
}

// Allow Enter key to submit password
document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkPassword();
        });
    }
});

// Break mode state cache (uses global from app.js)
// let breakModeState managed in app.js to avoid duplicate declaration
let settingsBreakModeCache = null;

/**
 * Fetch current break mode state from server
 */
async function fetchBreakModeState() {
    try {
        const response = await fetch('/api/break-mode', {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.breakMode) {
                settingsBreakModeCache = data.breakMode;
                console.log('[Settings] Break mode state loaded:', settingsBreakModeCache);
            }
        }
    } catch (error) {
        console.error('[Settings] Failed to fetch break mode:', error);
    }
    return settingsBreakModeCache;
}

/**
 * Populate break mode controls in settings
 */
async function populateBreakModeControls() {
    const container = document.getElementById('breakModeControls');
    if (!container || !settingsConfig?.streams) return;
    
    // Fetch latest state
    await fetchBreakModeState();
    
    // Use cache or empty defaults
    const state = settingsBreakModeCache || { "0": false, "1": false, "2": false, "3": false };
    
    container.innerHTML = settingsConfig.streams.map((stream, index) => {
        const isOnBreak = state[String(index)] === true;
        return `
            <div class="break-mode-row" data-stream-index="${index}">
                <span class="stream-name">${stream.name}</span>
                <div class="stream-status">
                    <span class="status-badge ${isOnBreak ? 'break' : 'live'}">
                        ${isOnBreak ? '🔴 BREAK' : '🟢 LIVE'}
                    </span>
                </div>
                <button 
                    class="btn-break ${isOnBreak ? 'go-live' : 'go-break'}" 
                    onclick="toggleBreakMode(${index}, ${!isOnBreak})"
                >
                    ${isOnBreak ? 'GO LIVE' : 'GO TO BREAK'}
                </button>
            </div>
        `;
    }).join('');
}

/**
 * Toggle break mode for a stream
 */
async function toggleBreakMode(streamIndex, setToBreak) {
    const row = document.querySelector(`.break-mode-row[data-stream-index="${streamIndex}"]`);
    const button = row?.querySelector('.btn-break');
    
    if (button) {
        button.disabled = true;
        button.textContent = 'Updating...';
    }
    
    try {
        const response = await fetch('/api/break-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                streamIndex: streamIndex,
                isOnBreak: setToBreak,
                updatedBy: 'producer'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update local cache
            settingsBreakModeCache = data.breakMode;
            
            // Update UI
            const badge = row?.querySelector('.status-badge');
            if (badge) {
                badge.className = `status-badge ${setToBreak ? 'break' : 'live'}`;
                badge.textContent = setToBreak ? '🔴 BREAK' : '🟢 LIVE';
            }
            if (button) {
                button.className = `btn-break ${setToBreak ? 'go-live' : 'go-break'}`;
                button.textContent = setToBreak ? 'GO LIVE' : 'GO TO BREAK';
                button.onclick = () => toggleBreakMode(streamIndex, !setToBreak);
            }
            
            console.log(`[Settings] Stream ${streamIndex} set to ${setToBreak ? 'BREAK' : 'LIVE'}`);
            
            // Notify app.js to update players immediately
            if (typeof handleBreakModeChange === 'function') {
                handleBreakModeChange(streamIndex, setToBreak, settingsBreakModeCache?.fallbackPlaybackId);
            }
        } else {
            throw new Error(data.error || 'Unknown error');
        }
        
    } catch (error) {
        console.error('[Settings] Break mode toggle failed:', error);
        alert('Failed to update break mode: ' + error.message);
        
        // Reset button
        if (button) {
            button.textContent = setToBreak ? 'GO TO BREAK' : 'GO LIVE';
        }
    } finally {
        if (button) button.disabled = false;
    }
}

// ============================================
// TAG MANAGEMENT
// ============================================

/**
 * Default utility tags - used when no tags exist in config
 */
const DEFAULT_UTILITY_TAGS = [
    { id: 'keep', name: 'Keep', color: '#22c55e', icon: '🟢' },
    { id: 'review', name: 'Review', color: '#f59e0b', icon: '🟡' },
    { id: 'archive', name: 'Archive', color: '#6b7280', icon: '📦' },
    { id: 'old_test', name: 'Old Test Stream', color: '#8b5cf6', icon: '🟣' }
];

/**
 * Populate tags configuration in settings
 */
function populateTagsConfig() {
    const container = document.getElementById('tagsConfig');
    if (!container) return;
    
    // Initialize tags array if it doesn't exist
    if (!settingsConfig.tags || settingsConfig.tags.length === 0) {
        settingsConfig.tags = JSON.parse(JSON.stringify(DEFAULT_UTILITY_TAGS));
        console.log('[Settings] Initialized default utility tags');
    }
    
    container.innerHTML = settingsConfig.tags.map((tag, index) => `
        <div class="tag-config-row" data-index="${index}">
            <input type="color" 
                   class="tag-color-picker" 
                   value="${tag.color || '#6b7280'}" 
                   onchange="updateTagColor(${index}, this.value)"
                   title="Tag color">
            <input type="text" 
                   class="input-field tag-icon-input" 
                   value="${tag.icon || ''}" 
                   placeholder="🏷️"
                   maxlength="2"
                   onchange="updateTagIcon(${index}, this.value)"
                   title="Tag icon (emoji)">
            <input type="text" 
                   class="input-field tag-name-input" 
                   value="${tag.name || ''}" 
                   placeholder="Tag Name"
                   onchange="updateTagName(${index}, this.value)"
                   title="Tag name">
            <button class="btn btn-danger btn-delete-tag" 
                    onclick="deleteTag(${index})" 
                    title="Delete tag">
                🗑️
            </button>
        </div>
    `).join('');
}

/**
 * Add a new tag
 */
function addNewTag() {
    if (!settingsConfig.tags) {
        settingsConfig.tags = [];
    }
    
    // Generate a unique ID
    const id = 'tag_' + Date.now();
    
    settingsConfig.tags.push({
        id: id,
        name: 'New Tag',
        color: '#6b7280',
        icon: '🏷️'
    });
    
    populateTagsConfig();
    
    // Focus the new tag name input
    setTimeout(() => {
        const inputs = document.querySelectorAll('.tag-name-input');
        if (inputs.length > 0) {
            inputs[inputs.length - 1].focus();
            inputs[inputs.length - 1].select();
        }
    }, 100);
}

/**
 * Update tag color
 */
function updateTagColor(index, color) {
    if (settingsConfig.tags && settingsConfig.tags[index]) {
        settingsConfig.tags[index].color = color;
    }
}

/**
 * Update tag icon
 */
function updateTagIcon(index, icon) {
    if (settingsConfig.tags && settingsConfig.tags[index]) {
        settingsConfig.tags[index].icon = icon;
    }
}

/**
 * Update tag name
 */
function updateTagName(index, name) {
    if (settingsConfig.tags && settingsConfig.tags[index]) {
        settingsConfig.tags[index].name = name;
        // Also update the ID to be URL-safe version of name
        settingsConfig.tags[index].id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }
}

/**
 * Delete a tag
 */
function deleteTag(index) {
    if (!settingsConfig.tags) return;
    
    const tag = settingsConfig.tags[index];
    if (!confirm(`Delete tag "${tag.name}"?\n\nRecordings with this tag will become untagged.`)) {
        return;
    }
    
    settingsConfig.tags.splice(index, 1);
    populateTagsConfig();
}

// ============================================
// BREAK VIDEO LIBRARY
// ============================================

/**
 * Populate break video library in settings
 */
function populateBreakVideoLibrary() {
    const container = document.getElementById('breakVideoLibrary');
    if (!container) return;
    
    // Initialize library if it doesn't exist
    if (!settingsConfig.breakVideoLibrary) {
        settingsConfig.breakVideoLibrary = [
            { id: 'break-1', name: 'Break Video 1', playbackId: '' },
            { id: 'break-2', name: 'Break Video 2', playbackId: '' },
            { id: 'break-3', name: 'Break Video 3', playbackId: '' },
            { id: 'break-4', name: 'Break Video 4', playbackId: '' }
        ];
    }
    
    container.innerHTML = settingsConfig.breakVideoLibrary.map((video, index) => {
        const hasVideo = video.playbackId && video.playbackId.trim() !== '';
        const thumbnailUrl = hasVideo 
            ? `https://image.mux.com/${video.playbackId}/thumbnail.jpg?width=160&height=90&time=5`
            : '';
        
        return `
            <div class="break-video-row ${hasVideo ? 'has-video' : ''}" data-index="${index}">
                <div class="slot-label">Video ${index + 1}</div>
                <div class="input-with-name">
                    <input type="text" 
                           class="input-field video-name-input" 
                           value="${video.name || ''}"
                           placeholder="Video name"
                           onchange="updateBreakVideoField(${index}, 'name', this.value)">
                    <input type="text" 
                           class="input-field playback-id-input" 
                           value="${video.playbackId || ''}"
                           placeholder="Paste Mux Playback ID here"
                           onchange="updateBreakVideoField(${index}, 'playbackId', this.value)">
                </div>
                <div class="video-preview">
                    ${hasVideo 
                        ? `<img src="${thumbnailUrl}" alt="Preview" onerror="this.parentElement.innerHTML='<span class=\'no-preview\'>No preview</span>'">`
                        : '<span class="no-preview">No video</span>'
                    }
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Update a break video field
 */
function updateBreakVideoField(index, field, value) {
    if (!settingsConfig.breakVideoLibrary || !settingsConfig.breakVideoLibrary[index]) return;
    
    settingsConfig.breakVideoLibrary[index][field] = value;
    
    // If playback ID changed, refresh to show/hide thumbnail
    if (field === 'playbackId') {
        populateBreakVideoLibrary();
    }
}

// ============================================
// TRANSITION SETTINGS
// ============================================

/**
 * Populate transition settings dropdowns
 */
function populateTransitionSettings() {
    // Initialize if doesn't exist
    if (!settingsConfig.transitionSettings) {
        settingsConfig.transitionSettings = {
            duration: 0.5,
            type: 'crossfade'
        };
    }
    
    const durationSelect = document.getElementById('settings-transitionDuration');
    const typeSelect = document.getElementById('settings-transitionType');
    
    if (durationSelect) {
        durationSelect.value = String(settingsConfig.transitionSettings.duration);
    }
    
    if (typeSelect) {
        typeSelect.value = settingsConfig.transitionSettings.type;
    }
}

/**
 * Populate settings form with current config
 */
function populateSettings() {
    if (!settingsConfig) {
        console.error('[Settings] No config available');
        return;
    }
    
    // Event Info
    setInputValue('settings-eventName', settingsConfig.eventName);
    setInputValue('settings-eventDate', settingsConfig.eventInfo?.date);
    setInputValue('settings-callTime', settingsConfig.eventInfo?.callTime);
    setInputValue('settings-liveStart', settingsConfig.eventInfo?.liveStart);
    setInputValue('settings-liveEnd', settingsConfig.eventInfo?.liveEnd);
    setInputValue('settings-producerName', settingsConfig.eventInfo?.producerName);
    setInputValue('settings-producerPhone', settingsConfig.eventInfo?.producerPhone);
    setInputValue('settings-whatsappLink', settingsConfig.eventInfo?.whatsappLink);
    setInputValue('settings-brief', settingsConfig.eventInfo?.brief);
    
    // Security
    setInputValue('settings-password', settingsConfig.producerPassword);
    
    // Expiry date - convert to datetime-local format
    if (settingsConfig.expiryDate) {
        const expiry = new Date(settingsConfig.expiryDate);
        const localDatetime = expiry.toISOString().slice(0, 16);
        setInputValue('settings-expiry', localDatetime);
    }
    
    // Display toggles
    setCheckbox('settings-showHealth', settingsConfig.visibility?.vuMeters !== false);
    setCheckbox('settings-showDuration', settingsConfig.visibility?.duration !== false);
    setCheckbox('settings-showBitrate', settingsConfig.visibility?.bitrate === true);
    setCheckbox('settings-showViewers', settingsConfig.visibility?.viewers === true);
    
    // Populate stream configs
    populateStreamConfigs();
    
    // Populate tags config
    populateTagsConfig();
    
    // Populate break video library
    populateBreakVideoLibrary();
    
    // Populate transition settings
    populateTransitionSettings();
    
    console.log('[Settings] Form populated');
}

/**
 * Helper to set input value
 */
function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
}

/**
 * Helper to set checkbox
 */
function setCheckbox(id, checked) {
    const el = document.getElementById(id);
    if (el) el.checked = checked;
}

/**
 * SVG Icons for Stream Config
 */
const ICONS = {
    lock: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    unlock: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
    copy: '<svg class="icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    plus: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
    stream: '<svg class="icon" viewBox="0 0 24 24"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
    check: '<svg class="icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
    eye: '<svg class="icon" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg class="icon" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    trash: '<svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
};

// Track new stream form state
let newStreamData = {
    name: '',
    tag: '',
    liveStreamId: '',
    playbackId: '',
    streamKey: '',
    rtmpUrl: 'rtmp://global-live.mux.com:5222/app'
};

/**
 * Create stream configuration sections
 */
function populateStreamConfigs() {
    const container = document.getElementById('streamConfigs');
    if (!container) return;
    
    const isLocked = settingsConfig.streamConfigLocked !== false;
    const streams = settingsConfig.streams || [];
    
    container.innerHTML = `
        <div class="stream-config-header">
            <h3>Stream Configuration</h3>
            <div class="stream-config-actions">
                <button type="button" class="btn-lock ${isLocked ? 'locked' : 'unlocked'}" onclick="toggleStreamLock()" title="${isLocked ? 'Unlock to edit' : 'Lock configuration'}">
                    ${isLocked ? ICONS.lock : ICONS.unlock}
                    ${isLocked ? 'Locked' : 'Unlocked'}
                </button>
                ${!isLocked ? `
                    <button type="button" class="btn btn-save-streams" onclick="saveStreamConfig()" title="Save stream changes">
                        ${ICONS.check}
                        Save Streams
                    </button>
                ` : ''}
                <button type="button" class="btn btn-create-mux" onclick="showNewStreamForm()" ${isLocked ? 'disabled' : ''} title="Create new stream in Mux">
                    ${ICONS.plus}
                    Create in Mux
                </button>
            </div>
        </div>
        
        <div id="streamsContainer" class="streams-container ${isLocked ? 'locked' : ''}">
            ${streams.length === 0 ? `
                <div class="streams-empty">
                    ${ICONS.stream}
                    <p>No streams configured</p>
                    <p style="font-size: 0.8rem; margin-top: 8px;">Unlock and click "Create in Mux" to add streams</p>
                </div>
            ` : streams.map((stream, index) => renderStreamCard(stream, index)).join('')}
        </div>
        
        <div id="newStreamForm" class="new-stream-form hidden">
            <h4>New Stream</h4>
            <div class="form-row">
                <div class="form-group">
                    <label>Stream Name *</label>
                    <input type="text" id="newStreamName" placeholder="e.g. Main Stage" oninput="updateNewStreamData('name', this.value)">
                </div>
                <div class="form-group">
                    <label>Tag</label>
                    <input type="text" id="newStreamTag" placeholder="e.g. Main" oninput="updateNewStreamData('tag', this.value)">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Live Stream ID</label>
                    <input type="text" id="newLiveStreamId" disabled placeholder="Auto-filled after creation">
                </div>
                <div class="form-group">
                    <label>Playback ID</label>
                    <input type="text" id="newPlaybackId" disabled placeholder="Auto-filled after creation">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Stream Key</label>
                    <input type="text" id="newStreamKey" disabled placeholder="Auto-filled after creation">
                </div>
                <div class="form-group">
                    <label>RTMP URL</label>
                    <input type="text" id="newRtmpUrl" disabled value="rtmp://global-live.mux.com:5222/app">
                </div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-create-mux" id="btnCreateInMux" onclick="createNewMuxLivestream()">
                    ${ICONS.plus}
                    Create in Mux
                </button>
                <button type="button" class="btn-save-stream" id="btnSaveStream" onclick="saveNewStream()" disabled>
                    ${ICONS.check}
                    Save Stream
                </button>
                <button type="button" class="btn-cancel-stream" onclick="cancelNewStream()">
                    Cancel
                </button>
            </div>
        </div>
    `;
}

/**
 * Generate break video dropdown options from library
 */
function getBreakVideoOptions(selectedId) {
    const library = settingsConfig.breakVideoLibrary || [];
    const validVideos = library.filter(v => v.playbackId && v.playbackId.trim() !== '');
    
    let options = '<option value="">-- None --</option>';
    validVideos.forEach((video, index) => {
        const selected = selectedId === video.id ? 'selected' : '';
        options += `<option value="${video.id}" ${selected}>${video.name || 'Video ' + (index + 1)}</option>`;
    });
    
    return options;
}

/**
 * Render a single stream card
 */
function renderStreamCard(stream, index) {
    const isLocked = settingsConfig.streamConfigLocked !== false;
    return `
        <div class="stream-config" data-index="${index}">
            <div class="stream-header">
                <h4>Stream ${index + 1}</h4>
                ${!isLocked ? `
                    <button type="button" class="btn-delete-stream" onclick="deleteStream(${index})" title="Delete this stream">
                        ${ICONS.trash}
                        Delete
                    </button>
                ` : ''}
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Stream Name</label>
                    <input type="text" id="streamname-${index}" class="input-field" value="${stream.name || ''}" ${isLocked ? 'readonly' : ''} onchange="updateStreamField(${index}, 'name', this.value)">
                </div>
                <div class="form-group">
                    <label>Tag</label>
                    <input type="text" id="streamtag-${index}" class="input-field" value="${stream.tag || ''}" ${isLocked ? 'readonly' : ''} placeholder="e.g. Main" onchange="updateStreamField(${index}, 'tag', this.value)">
                </div>
            </div>
            <div class="config-row">
                <label>Live Stream ID</label>
                <div class="input-with-copy">
                    <input type="text" id="livestreamid-${index}" class="input-field" value="${stream.liveStreamId || ''}" readonly>
                    <button type="button" class="btn-copy" onclick="copyField('livestreamid-${index}', this)" title="Copy">
                        ${ICONS.copy}
                    </button>
                </div>
            </div>
            <div class="config-row">
                <label>Playback ID</label>
                <div class="input-with-copy">
                    <input type="text" id="playback-${index}" class="input-field" value="${stream.playbackId || ''}" readonly>
                    <button type="button" class="btn-copy" onclick="copyField('playback-${index}', this)" title="Copy">
                        ${ICONS.copy}
                    </button>
                </div>
            </div>
            <div class="config-row">
                <label>Stream Key</label>
                <div class="input-with-copy">
                    <input type="password" id="streamkey-${index}" class="input-field" value="${stream.streamKey || ''}" readonly>
                    <button type="button" class="btn-show" onclick="toggleStreamKeyVisibility(${index})" title="Show/Hide">
                        ${ICONS.eye}
                    </button>
                    <button type="button" class="btn-copy" onclick="copyField('streamkey-${index}', this)" title="Copy">
                        ${ICONS.copy}
                    </button>
                </div>
            </div>
            <div class="config-row">
                <label>RTMP URL</label>
                <div class="input-with-copy">
                    <input type="text" id="rtmp-${index}" class="input-field" value="${stream.rtmpUrl || 'rtmp://global-live.mux.com:5222/app'}" readonly>
                    <button type="button" class="btn-copy" onclick="copyField('rtmp-${index}', this)" title="Copy">
                        ${ICONS.copy}
                    </button>
                </div>
            </div>
            <div class="break-video-assignment">
                <div class="config-row">
                    <label>Break 1 Video</label>
                    <select id="breakvideo1-${index}" class="input-field" onchange="updateStreamField(${index}, 'breakVideo1', this.value)">
                        ${getBreakVideoOptions(stream.breakVideo1)}
                    </select>
                </div>
                <div class="config-row">
                    <label>Break 2 Video</label>
                    <select id="breakvideo2-${index}" class="input-field" onchange="updateStreamField(${index}, 'breakVideo2', this.value)">
                        ${getBreakVideoOptions(stream.breakVideo2)}
                    </select>
                </div>
            </div>
        </div>
    `;
}

/**
 * Update a field on an existing stream
 */
function updateStreamField(index, field, value) {
    if (!settingsConfig.streams || !settingsConfig.streams[index]) return;
    settingsConfig.streams[index][field] = value;
    
    // If updating tag, also update tags list
    if (field === 'tag' && value) {
        if (!settingsConfig.tags) settingsConfig.tags = [];
        const tagExists = settingsConfig.tags.some(t => t.name.toLowerCase() === value.toLowerCase());
        if (!tagExists) {
            const hue = Math.abs(value.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0) % 360);
            settingsConfig.tags.push({
                id: value.toLowerCase().replace(/\s+/g, '_'),
                name: value,
                color: `hsl(${hue}, 60%, 45%)`,
                icon: '🎬'
            });
        }
    }
}

/**
 * Delete a stream
 */
function deleteStream(index) {
    if (settingsConfig.streamConfigLocked !== false) return;
    
    const stream = settingsConfig.streams[index];
    if (!stream) return;
    
    if (!confirm(`Delete "${stream.name || 'Stream ' + (index + 1)}"?\n\nThis removes it from the dashboard.\nThe livestream still exists in Mux.\n\nClick "Save Streams" to confirm.`)) {
        return;
    }
    
    settingsConfig.streams.splice(index, 1);
    populateStreamConfigs();
}

/**
 * Save stream configuration to server
 */
async function saveStreamConfig() {
    const button = document.querySelector('.btn-save-streams');
    if (button) {
        button.innerHTML = '<span class="spinner"></span> Saving...';
        button.disabled = true;
    }
    
    // Gather current stream data from inputs
    settingsConfig.streams.forEach((stream, index) => {
        stream.name = document.getElementById(`streamname-${index}`)?.value || stream.name || '';
        stream.tag = document.getElementById(`streamtag-${index}`)?.value || '';
    });
    
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsConfig)
        });
        
        if (!response.ok) throw new Error('Save failed');
        
        // Sync with global config
        if (typeof config !== 'undefined') {
            Object.assign(config, settingsConfig);
        }
        
        // Refresh Break Mode and players
        await populateMainBreakControls();
        if (typeof initPlayers === 'function') {
            initPlayers();
        }
        
        if (button) {
            button.innerHTML = `${ICONS.check} Saved!`;
            button.classList.add('btn-success');
            setTimeout(() => {
                button.innerHTML = `${ICONS.check} Save Streams`;
                button.classList.remove('btn-success');
                button.disabled = false;
            }, 2000);
        }
        
        console.log('[Settings] Stream config saved');
        
    } catch (error) {
        console.error('[Settings] Stream config save failed:', error);
        if (button) {
            button.innerHTML = '❌ Failed';
            setTimeout(() => {
                button.innerHTML = `${ICONS.check} Save Streams`;
                button.disabled = false;
            }, 2000);
        }
        alert('Failed to save stream configuration: ' + error.message);
    }
}

/**
 * Get tag color from config or generate one
 */
function getTagColor(tagName) {
    if (!tagName) return '#6b7280';
    const tag = settingsConfig.tags?.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    if (tag) return tag.color;
    // Generate consistent color from tag name
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
        hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 60%, 45%)`;
}

/**
 * Toggle stream configuration lock
 */
function toggleStreamLock() {
    const isCurrentlyLocked = settingsConfig.streamConfigLocked !== false;
    
    if (isCurrentlyLocked) {
        // Unlocking - show warning
        if (!confirm('⚠️ WARNING\n\nUnlocking stream configuration allows creating new streams.\n\nDo NOT unlock during a live event unless absolutely necessary.\n\nProceed?')) {
            return;
        }
    }
    
    settingsConfig.streamConfigLocked = !isCurrentlyLocked;
    populateStreamConfigs();
}

/**
 * Show new stream form
 */
function showNewStreamForm() {
    if (settingsConfig.streamConfigLocked !== false) return;
    
    // Reset form data
    newStreamData = {
        name: '',
        tag: '',
        liveStreamId: '',
        playbackId: '',
        streamKey: '',
        rtmpUrl: 'rtmp://global-live.mux.com:5222/app'
    };
    
    const form = document.getElementById('newStreamForm');
    if (form) {
        form.classList.remove('hidden');
        // Reset form fields
        document.getElementById('newStreamName').value = '';
        document.getElementById('newStreamTag').value = '';
        document.getElementById('newLiveStreamId').value = '';
        document.getElementById('newPlaybackId').value = '';
        document.getElementById('newStreamKey').value = '';
        document.getElementById('newRtmpUrl').value = 'rtmp://global-live.mux.com:5222/app';
        // Reset button states
        document.getElementById('btnCreateInMux').disabled = false;
        document.getElementById('btnSaveStream').disabled = true;
        // Focus on name field
        document.getElementById('newStreamName').focus();
    }
}

/**
 * Update new stream data as user types
 */
function updateNewStreamData(field, value) {
    newStreamData[field] = value;
}

/**
 * Create new livestream in Mux
 */
async function createNewMuxLivestream() {
    const name = document.getElementById('newStreamName').value.trim();
    
    if (!name) {
        alert('Please enter a Stream Name first.');
        document.getElementById('newStreamName').focus();
        return;
    }
    
    const button = document.getElementById('btnCreateInMux');
    const originalHTML = button.innerHTML;
    button.innerHTML = '<span class="spinner"></span> Creating...';
    button.disabled = true;
    
    try {
        const response = await fetch('/api/create-livestream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Populate the form fields
            newStreamData.liveStreamId = data.liveStreamId;
            newStreamData.playbackId = data.playbackId;
            newStreamData.streamKey = data.streamKey;
            newStreamData.rtmpUrl = data.rtmpUrl;
            newStreamData.name = name;
            newStreamData.tag = document.getElementById('newStreamTag').value.trim();
            
            // Update form display
            const liveStreamIdInput = document.getElementById('newLiveStreamId');
            const playbackIdInput = document.getElementById('newPlaybackId');
            const streamKeyInput = document.getElementById('newStreamKey');
            const rtmpUrlInput = document.getElementById('newRtmpUrl');
            
            liveStreamIdInput.value = data.liveStreamId;
            playbackIdInput.value = data.playbackId;
            streamKeyInput.value = data.streamKey;
            rtmpUrlInput.value = data.rtmpUrl;
            
            // Add visual feedback for auto-filled fields
            liveStreamIdInput.classList.add('auto-filled');
            playbackIdInput.classList.add('auto-filled');
            streamKeyInput.classList.add('auto-filled');
            rtmpUrlInput.classList.add('auto-filled');
            
            // Enable save button
            document.getElementById('btnSaveStream').disabled = false;
            
            // Update create button
            button.innerHTML = `${ICONS.check} Created!`;
            button.classList.add('btn-success');
            
        } else {
            throw new Error(data.error || 'Failed to create livestream');
        }
    } catch (error) {
        console.error('Create livestream error:', error);
        alert('Failed to create livestream: ' + error.message);
        button.innerHTML = originalHTML;
        button.disabled = false;
    }
}

/**
 * Save the new stream to config
 */
async function saveNewStream() {
    if (!newStreamData.liveStreamId) {
        alert('Please create the stream in Mux first.');
        return;
    }
    
    // Add stream to config
    if (!settingsConfig.streams) settingsConfig.streams = [];
    
    settingsConfig.streams.push({
        name: newStreamData.name,
        tag: newStreamData.tag,
        liveStreamId: newStreamData.liveStreamId,
        playbackId: newStreamData.playbackId,
        streamKey: newStreamData.streamKey,
        rtmpUrl: newStreamData.rtmpUrl
    });
    
    // Add tag to tags list if it doesn't exist
    if (newStreamData.tag) {
        if (!settingsConfig.tags) settingsConfig.tags = [];
        const tagExists = settingsConfig.tags.some(t => t.name.toLowerCase() === newStreamData.tag.toLowerCase());
        if (!tagExists) {
            // Generate a color for the new tag
            const hue = Math.abs(newStreamData.tag.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0) % 360);
            settingsConfig.tags.push({
                id: newStreamData.tag.toLowerCase().replace(/\s+/g, '_'),
                name: newStreamData.tag,
                color: `hsl(${hue}, 60%, 45%)`,
                icon: '🎬'
            });
        }
    }
    
    // Hide form and refresh display
    document.getElementById('newStreamForm').classList.add('hidden');
    populateStreamConfigs();
    populateTagsConfig();
    
    // Show success
    alert(`Stream "${newStreamData.name}" added!\n\nDon't forget to Save Settings.`);
}

/**
 * Cancel new stream creation
 */
function cancelNewStream() {
    document.getElementById('newStreamForm').classList.add('hidden');
    // Note: If they created in Mux but didn't save, the livestream still exists in Mux
    // That's okay - it can be used later or deleted from Mux dashboard
}

/**
 * Copy field value to clipboard
 */
function copyField(fieldId, button) {
    const input = document.getElementById(fieldId);
    if (!input || !input.value) {
        return;
    }
    
    navigator.clipboard.writeText(input.value).then(() => {
        button.classList.add('copied');
        setTimeout(() => button.classList.remove('copied'), 1500);
    }).catch(err => {
        console.error('Copy failed:', err);
    });
}

/**
 * Toggle stream key visibility
 */
function toggleStreamKeyVisibility(index) {
    const input = document.getElementById(`streamkey-${index}`);
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
}

/**
 * Toggle password visibility
 */
function togglePasswordVisibility() {
    const input = document.getElementById('settings-password');
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text, button) {
    if (!text) {
        button.textContent = '❌';
        setTimeout(() => button.textContent = '📋', 1500);
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        button.textContent = '✓';
        button.classList.add('copy-success');
        setTimeout(() => {
            button.textContent = '📋';
            button.classList.remove('copy-success');
        }, 1500);
    }).catch(err => {
        console.error('[Settings] Copy failed:', err);
        button.textContent = '❌';
        setTimeout(() => button.textContent = '📋', 1500);
    });
}

/**
 * Handle SMS share button
 */
function handleSMSShare() {
    const eventName = settingsConfig?.eventName || 'Event';
    const url = window.location.href;
    const message = `Join the ${eventName} crew dashboard: ${url}`;
    
    // Open SMS app with pre-filled message
    window.location.href = `sms:?body=${encodeURIComponent(message)}`;
}

/**
 * Save all settings to server (Netlify Blobs)
 */
async function saveSettings() {
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) {
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;
    }
    
    // Gather event info
    settingsConfig.eventName = document.getElementById('settings-eventName')?.value || settingsConfig.eventName;
    
    settingsConfig.eventInfo = settingsConfig.eventInfo || {};
    settingsConfig.eventInfo.date = document.getElementById('settings-eventDate')?.value || '';
    settingsConfig.eventInfo.callTime = document.getElementById('settings-callTime')?.value || '';
    settingsConfig.eventInfo.liveStart = document.getElementById('settings-liveStart')?.value || '';
    settingsConfig.eventInfo.liveEnd = document.getElementById('settings-liveEnd')?.value || '';
    settingsConfig.eventInfo.producerName = document.getElementById('settings-producerName')?.value || '';
    settingsConfig.eventInfo.producerPhone = document.getElementById('settings-producerPhone')?.value || '';
    settingsConfig.eventInfo.whatsappLink = document.getElementById('settings-whatsappLink')?.value || '';
    settingsConfig.eventInfo.brief = document.getElementById('settings-brief')?.value || '';
    
    // Security
    const newPassword = document.getElementById('settings-password')?.value;
    if (newPassword) {
        settingsConfig.producerPassword = newPassword;
    }
    
    // Expiry
    const expiryValue = document.getElementById('settings-expiry')?.value;
    if (expiryValue) {
        settingsConfig.expiryDate = new Date(expiryValue).toISOString();
    }
    
    // Display toggles
    settingsConfig.visibility = settingsConfig.visibility || {};
    settingsConfig.visibility.vuMeters = document.getElementById('settings-showHealth')?.checked ?? true;
    settingsConfig.visibility.streamStatus = true;
    settingsConfig.visibility.duration = document.getElementById('settings-showDuration')?.checked ?? true;
    settingsConfig.visibility.bitrate = document.getElementById('settings-showBitrate')?.checked ?? false;
    settingsConfig.visibility.viewers = document.getElementById('settings-showViewers')?.checked ?? false;
    
    // Gather transition settings
    settingsConfig.transitionSettings = settingsConfig.transitionSettings || {};
    settingsConfig.transitionSettings.duration = parseFloat(document.getElementById('settings-transitionDuration')?.value) || 0.5;
    settingsConfig.transitionSettings.type = document.getElementById('settings-transitionType')?.value || 'crossfade';
    
    // Gather all stream data from inputs
    settingsConfig.streams.forEach((stream, index) => {
        stream.name = document.getElementById(`streamname-${index}`)?.value || stream.name || '';
        stream.tag = document.getElementById(`streamtag-${index}`)?.value || '';
        stream.liveStreamId = document.getElementById(`livestreamid-${index}`)?.value || '';
        stream.playbackId = document.getElementById(`playback-${index}`)?.value || '';
        stream.streamKey = document.getElementById(`streamkey-${index}`)?.value || '';
        stream.rtmpUrl = document.getElementById(`rtmp-${index}`)?.value || 'rtmp://global-live.mux.com:5222/app';
        stream.breakVideo1 = document.getElementById(`breakvideo1-${index}`)?.value || null;
        stream.breakVideo2 = document.getElementById(`breakvideo2-${index}`)?.value || null;
    });
    
    // Ensure streamBaseUrl is preserved
    if (!settingsConfig.streamBaseUrl) {
        settingsConfig.streamBaseUrl = 'https://live-dashboard.bluehaze.studio/mux-stream/';
    }
    
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsConfig)
        });
        
        if (!response.ok) throw new Error('Save failed');
        
        if (saveBtn) {
            saveBtn.textContent = '✓ Saved!';
            saveBtn.classList.add('save-success');
            setTimeout(() => {
                saveBtn.textContent = '💾 Save Settings';
                saveBtn.classList.remove('save-success');
                saveBtn.disabled = false;
            }, 2000);
        }
        
        console.log('[Settings] Config saved successfully');
        
        // Update page title if event name changed
        const titleEl = document.getElementById('eventTitle');
        if (titleEl) titleEl.textContent = settingsConfig.eventName;
        
        // Sync with global config used by app.js
        if (typeof config !== 'undefined') {
            Object.assign(config, settingsConfig);
        }
        
        // Refresh Break Mode panel with updated streams
        await populateMainBreakControls();
        
        // Refresh main dashboard players if streams changed
        if (typeof initPlayers === 'function') {
            initPlayers();
        }
        
    } catch (error) {
        console.error('[Settings] Save failed:', error);
        if (saveBtn) {
            saveBtn.textContent = '✗ Failed';
            saveBtn.classList.add('save-error');
            setTimeout(() => {
                saveBtn.textContent = '💾 Save Settings';
                saveBtn.classList.remove('save-error');
                saveBtn.disabled = false;
            }, 2000);
        }
    }
}

/**
 * Sync images to Mux (slate images for reconnect)
 */
async function syncImagesToMux() {
    const button = document.getElementById('btnSyncImages');
    const statusDiv = document.getElementById('muxImagesStatus');
    
    if (button) {
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span> Syncing...';
    }
    
    try {
        // First preview
        const previewResponse = await fetch('/api/sync-images?action=preview');
        const previewData = await previewResponse.json();
        
        if (!previewData.success) {
            throw new Error(previewData.error || 'Preview failed');
        }
        
        // Show preview and confirm
        const streamList = previewData.results.map(r => 
            `• Stream ${r.stream} (${r.name}): ${r.slateUrl}`
        ).join('\n');
        
        if (!confirm(`Sync slate images to Mux?\n\n${streamList}\n\nThis will update the reconnect slate for each stream.`)) {
            if (button) {
                button.disabled = false;
                button.innerHTML = '🔄 Sync Images to Mux';
            }
            return;
        }
        
        // Apply
        const applyResponse = await fetch('/api/sync-images?action=apply');
        const applyData = await applyResponse.json();
        
        if (!applyData.success) {
            throw new Error(applyData.error || 'Apply failed');
        }
        
        // Show results
        const successCount = applyData.results.filter(r => r.status === 'success').length;
        const failCount = applyData.results.filter(r => r.status === 'error').length;
        
        if (statusDiv) {
            statusDiv.innerHTML = `<span class="success">✓ ${successCount} stream(s) updated</span>` +
                (failCount > 0 ? `<span class="error"> • ${failCount} failed</span>` : '');
            statusDiv.classList.add('show');
        }
        
        if (button) {
            button.innerHTML = '✓ Synced!';
            button.classList.add('btn-success');
            setTimeout(() => {
                button.innerHTML = '🔄 Sync Images to Mux';
                button.classList.remove('btn-success');
                button.disabled = false;
            }, 3000);
        }
        
        console.log('[Settings] Mux images synced:', applyData.results);
        
    } catch (error) {
        console.error('[Settings] Sync images failed:', error);
        
        if (statusDiv) {
            statusDiv.innerHTML = `<span class="error">✗ ${error.message}</span>`;
            statusDiv.classList.add('show');
        }
        
        if (button) {
            button.innerHTML = '✗ Failed';
            button.classList.add('btn-error');
            setTimeout(() => {
                button.innerHTML = '🔄 Sync Images to Mux';
                button.classList.remove('btn-error');
                button.disabled = false;
            }, 3000);
        }
    }
}

// Reset Dashboard to defaults
async function resetDashboard() {
    if (!confirm('Are you sure you want to reset the dashboard?\n\nThis will:\n• Clear all event information\n• Reset to single "Event Monitor" stream\n• Clear all stream IDs and keys\n• Reset expiry date\n\nThis cannot be undone.')) {
        return;
    }
    
    // Default config
    const defaultConfig = {
        eventName: 'Mediahouse Crew Dashboard',
        eventDate: '',
        callTime: '',
        liveStart: '',
        liveEnd: '',
        producerName: '',
        producerPhone: '',
        whatsappLink: '',
        brief: '',
        dashboardExpiry: '',
        streams: [
            {
                name: 'Event Monitor',
                liveStreamId: '',
                playbackId: '',
                streamKey: '',
                rtmpUrl: 'rtmp://global-live.mux.com:5222/app',
                breakMode: false
            }
        ],
        displayOptions: {
            showHealth: true,
            showDuration: true,
            showBitrate: true,
            showViewers: false
        },
        breakVideoUrl: '',
        streamBaseUrl: 'https://stream.mux.com/'
    };
    
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(defaultConfig)
        });
        
        if (!response.ok) throw new Error('Reset failed');
        
        alert('✅ Dashboard reset successfully!\n\nThe page will now reload.');
        window.location.reload();
        
    } catch (error) {
        console.error('[Settings] Reset failed:', error);
        alert('❌ Failed to reset dashboard: ' + error.message);
    }
}
