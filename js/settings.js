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
        
        const recordingsBtn = document.getElementById('recordingsBtn');
        if (recordingsBtn) recordingsBtn.style.display = 'inline-flex';
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
        
        // Show recordings button in header
        const recordingsBtn = document.getElementById('recordingsBtn');
        if (recordingsBtn) recordingsBtn.style.display = 'inline-flex';
        
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
    const panel = document.getElementById('breakModePanel');
    if (panel) {
        panel.style.display = 'block';
        populateMainBreakControls();
        console.log('[Settings] Break mode panel shown on dashboard');
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
 * Create stream configuration sections
 */
function populateStreamConfigs() {
    const container = document.getElementById('streamConfigs');
    if (!container || !settingsConfig.streams) return;
    
    container.innerHTML = settingsConfig.streams.map((stream, index) => `
        <div class="stream-config" data-index="${index}">
            <h4>Stream ${index + 1}: ${stream.name}</h4>
            <div class="config-row">
                <label>Live Stream ID</label>
                <div class="input-with-copy">
                    <input type="text" id="livestreamid-${index}" class="input-field" value="${stream.liveStreamId || ''}" placeholder="Mux Live Stream ID (for status check)">
                    <button type="button" class="btn-copy" onclick="copyToClipboard(document.getElementById('livestreamid-${index}').value, this)">📋</button>
                </div>
            </div>
            <div class="config-row">
                <label>Playback ID</label>
                <div class="input-with-copy">
                    <input type="text" id="playback-${index}" class="input-field" value="${stream.playbackId || ''}" placeholder="Mux Playback ID (for video URL)">
                    <button type="button" class="btn-copy" onclick="copyToClipboard(document.getElementById('playback-${index}').value, this)">📋</button>
                </div>
            </div>
            <div class="config-row">
                <label>Stream Key</label>
                <div class="input-with-copy">
                    <input type="password" id="streamkey-${index}" class="input-field" value="${stream.streamKey || ''}" placeholder="Enter Stream Key">
                    <button type="button" class="btn-show" onclick="toggleStreamKeyVisibility(${index})">👁</button>
                    <button type="button" class="btn-copy" onclick="copyToClipboard(document.getElementById('streamkey-${index}').value, this)">📋</button>
                </div>
            </div>
            <div class="config-row">
                <label>RTMP URL</label>
                <div class="input-with-copy">
                    <input type="text" id="rtmp-${index}" class="input-field" value="${stream.rtmpUrl || 'rtmp://global-live.mux.com:5222/app'}">
                    <button type="button" class="btn-copy" onclick="copyToClipboard(document.getElementById('rtmp-${index}').value, this)">📋</button>
                </div>
            </div>
        </div>
    `).join('');
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
    
    // Gather all stream data from inputs
    settingsConfig.streams.forEach((stream, index) => {
        stream.liveStreamId = document.getElementById(`livestreamid-${index}`)?.value || '';
        stream.playbackId = document.getElementById(`playback-${index}`)?.value || '';
        stream.streamKey = document.getElementById(`streamkey-${index}`)?.value || '';
        stream.rtmpUrl = document.getElementById(`rtmp-${index}`)?.value || 'rtmp://global-live.mux.com:5222/app';
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
