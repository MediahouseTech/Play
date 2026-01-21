/* ============================================
   RECORDINGS MANAGER - JavaScript (Full Featured)
   ============================================ */

// State
let recordings = [];
let filteredRecordings = [];
let selectedRecordings = new Set();
let currentPreviewAsset = null;
let currentDeleteAsset = null;
let currentEditAsset = null;
let hlsPlayer = null;
let currentView = 'grid';
let lastRefreshTime = null;
let clipChapters = {};
let clipInPoint = null;
let clipOutPoint = null;
let previewModalOpen = false;

// Dynamic config (loaded from server)
let dashboardConfig = null;
let customTags = [];

const PRODUCER_PASSWORD = 'Live2Stream';
const AUTH_SESSION_KEY = 'producerAuth';

// Default tags (fallback if config not loaded)
const DEFAULT_TAGS = [
    { id: 'keep', name: 'Keep', color: '#22c55e', icon: '🟢' },
    { id: 'review', name: 'Review', color: '#f59e0b', icon: '🟡' },
    { id: 'archive', name: 'Archive', color: '#6b7280', icon: '📦' },
    { id: 'old_test', name: 'Old Test Stream', color: '#8b5cf6', icon: '🟣' }
];

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if embedded in iframe (from main dashboard)
    const urlParams = new URLSearchParams(window.location.search);
    const isEmbedded = urlParams.get('embedded') === 'true' || window.parent !== window;
    
    if (isEmbedded || sessionStorage.getItem(AUTH_SESSION_KEY) === 'true') {
        showApp();
    }
    
    document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkLogin();
    });
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Rename pattern preview
    document.getElementById('renamePattern')?.addEventListener('input', updateRenamePreview);
});

function checkLogin() {
    const password = document.getElementById('loginPassword').value;
    if (password === PRODUCER_PASSWORD) {
        sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
        showApp();
    } else {
        document.getElementById('loginError').classList.add('show');
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginPassword').focus();
    }
}

async function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    // Load config first (for tags and streams)
    await loadConfig();
    
    // Populate dynamic dropdowns
    populateTagFilters();
    
    // Then load recordings
    loadRecordings();
}

/**
 * Load dashboard config (for tags and streams)
 */
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            dashboardConfig = await response.json();
            customTags = dashboardConfig.tags || DEFAULT_TAGS;
            console.log('[Recordings] Config loaded, tags:', customTags.length);
        }
    } catch (error) {
        console.error('[Recordings] Failed to load config:', error);
        customTags = DEFAULT_TAGS;
    }
}

/**
 * Populate tag filter dropdown with dynamic tags
 */
function populateTagFilters() {
    const tagFilter = document.getElementById('tagFilter');
    const previewTag = document.getElementById('previewTag');
    
    if (tagFilter) {
        tagFilter.innerHTML = '<option value="">All Tags</option>';
        customTags.forEach(tag => {
            tagFilter.innerHTML += `<option value="${tag.id}">${tag.icon || ''} ${tag.name}</option>`;
        });
        tagFilter.innerHTML += '<option value="none">No Tag</option>';
    }
    
    if (previewTag) {
        previewTag.innerHTML = '<option value="">No Tag</option>';
        customTags.forEach(tag => {
            previewTag.innerHTML += `<option value="${tag.id}">${tag.icon || ''} ${tag.name}</option>`;
        });
    }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

function handleKeyboardShortcuts(e) {
    // Ignore if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
    }
    
    // Preview modal shortcuts
    if (previewModalOpen) {
        const video = document.getElementById('previewVideo');
        switch(e.key) {
            case ' ':
                e.preventDefault();
                video.paused ? video.play() : video.pause();
                break;
            case 'ArrowLeft':
                video.currentTime = Math.max(0, video.currentTime - 5);
                break;
            case 'ArrowRight':
                video.currentTime = Math.min(video.duration, video.currentTime + 5);
                break;
            case 'i':
            case 'I':
                setInPoint();
                break;
            case 'o':
            case 'O':
                setOutPoint();
                break;
            case 'm':
            case 'M':
                addChapterAtCurrentTime();
                break;
            case 'Escape':
                closePreview();
                break;
        }
        return;
    }
    
    // List view shortcuts
    switch(e.key) {
        case 'a':
        case 'A':
            e.preventDefault();
            document.getElementById('selectAll').click();
            break;
        case 'd':
        case 'D':
            if (selectedRecordings.size > 0) {
                e.preventDefault();
                bulkDownload();
            }
            break;
        case 'Delete':
        case 'Backspace':
            if (selectedRecordings.size > 0) {
                e.preventDefault();
                bulkDelete();
            }
            break;
        case 'r':
        case 'R':
            e.preventDefault();
            refreshRecordings();
            break;
        case 'g':
        case 'G':
            setView('grid');
            break;
        case 'l':
        case 'L':
            setView('list');
            break;
        case '?':
            openShortcuts();
            break;
    }
}

function openShortcuts() {
    document.getElementById('shortcutsModal').classList.add('show');
}

function closeShortcuts() {
    document.getElementById('shortcutsModal').classList.remove('show');
}

// ============================================
// DATA LOADING
// ============================================

async function loadRecordings() {
    showLoading(true);
    
    try {
        const response = await fetch('/api/recordings');
        const data = await response.json();
        
        if (data.success && data.recordings && data.recordings.length > 0) {
            recordings = data.recordings;
            applyFiltersAndSort();
            updateStats();
            updateLastRefresh();
        } else {
            await refreshRecordings();
        }
    } catch (error) {
        console.error('Error loading recordings:', error);
        showEmpty();
    }
    
    showLoading(false);
}

async function refreshRecordings() {
    showLoading(true);
    
    try {
        const response = await fetch('/api/recordings?action=refresh');
        const data = await response.json();
        
        if (data.success) {
            recordings = data.recordings || [];
            applyFiltersAndSort();
            updateStats();
            updateLastRefresh();
            
            if (recordings.length === 0) {
                showEmpty();
            }
        } else {
            throw new Error(data.error || 'Failed to refresh');
        }
    } catch (error) {
        console.error('Error refreshing recordings:', error);
        alert('Failed to refresh recordings: ' + error.message);
    }
    
    showLoading(false);
}

function updateLastRefresh() {
    lastRefreshTime = new Date();
    document.getElementById('lastRefresh').textContent = 'Updated: just now';
    
    // Update every minute
    setInterval(() => {
        if (!lastRefreshTime) return;
        const mins = Math.floor((Date.now() - lastRefreshTime) / 60000);
        if (mins < 1) {
            document.getElementById('lastRefresh').textContent = 'Updated: just now';
        } else if (mins === 1) {
            document.getElementById('lastRefresh').textContent = 'Updated: 1 min ago';
        } else {
            document.getElementById('lastRefresh').textContent = `Updated: ${mins} mins ago`;
        }
    }, 60000);
}

// ============================================
// FILTERING & SORTING
// ============================================

function filterRecordings() {
    applyFiltersAndSort();
}

function sortRecordings() {
    applyFiltersAndSort();
}

function applyFiltersAndSort() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const durationFilter = document.getElementById('durationFilter').value;
    const tagFilter = document.getElementById('tagFilter').value;
    const sortBy = document.getElementById('sortBy').value;
    
    // Filter
    filteredRecordings = recordings.filter(rec => {
        const matchesSearch = !searchTerm || 
            rec.title?.toLowerCase().includes(searchTerm) ||
            rec.streamName?.toLowerCase().includes(searchTerm) ||
            rec.createdFormatted?.toLowerCase().includes(searchTerm) ||
            rec.externalId?.toLowerCase().includes(searchTerm) ||
            rec.notes?.toLowerCase().includes(searchTerm);
        
        let matchesDuration = true;
        if (durationFilter === 'short') {
            matchesDuration = rec.duration < 120; // Under 2 mins
        } else if (durationFilter) {
            matchesDuration = rec.duration >= parseInt(durationFilter) * 60;
        }
        
        let matchesTag = true;
        if (tagFilter === 'none') {
            matchesTag = !rec.tag;
        } else if (tagFilter) {
            matchesTag = rec.tag === tagFilter;
        }
        
        // Hide archived unless specifically filtering for them
        if (tagFilter !== 'archive' && rec.tag === 'archive') {
            return false;
        }
        
        return matchesSearch && matchesDuration && matchesTag;
    });
    
    // Sort
    filteredRecordings.sort((a, b) => {
        switch (sortBy) {
            case 'date-desc':
                return parseInt(b.createdAt) - parseInt(a.createdAt);
            case 'date-asc':
                return parseInt(a.createdAt) - parseInt(b.createdAt);
            case 'duration-desc':
                return b.duration - a.duration;
            case 'duration-asc':
                return a.duration - b.duration;
            case 'stream':
                return (a.streamName || '').localeCompare(b.streamName || '');
            default:
                return 0;
        }
    });
    
    renderRecordings();
    updateBulkButtons();
}

// ============================================
// SELECT SHORT CLIPS
// ============================================

function selectShortClips() {
    selectedRecordings.clear();
    
    filteredRecordings.forEach(rec => {
        if (rec.duration < 120) { // Under 2 minutes
            selectedRecordings.add(rec.assetId);
        }
    });
    
    renderRecordings();
    updateBulkButtons();
    updateSelectAllCheckbox();
}

// ============================================
// VIEW TOGGLE
// ============================================

function setView(view) {
    currentView = view;
    
    document.getElementById('gridViewBtn').classList.toggle('active', view === 'grid');
    document.getElementById('listViewBtn').classList.toggle('active', view === 'list');
    
    document.getElementById('recordingsGrid').style.display = view === 'grid' ? 'grid' : 'none';
    document.getElementById('recordingsList').style.display = view === 'list' ? 'block' : 'none';
    
    renderRecordings();
}

// ============================================
// RENDERING
// ============================================

function renderRecordings() {
    const grid = document.getElementById('recordingsGrid');
    const listBody = document.getElementById('recordingsTableBody');
    const emptyState = document.getElementById('emptyState');
    
    if (filteredRecordings.length === 0) {
        grid.innerHTML = '';
        listBody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Render Grid View
    grid.innerHTML = filteredRecordings.map(rec => {
        const thumbnailUrl = rec.playbackId 
            ? `https://image.mux.com/${rec.playbackId}/thumbnail.jpg?time=10&width=640`
            : '';
        
        const isSelected = selectedRecordings.has(rec.assetId);
        const isUntagged = !rec.tag;
        const tagBadge = rec.tag ? `<span class="tag-badge ${rec.tag}">${getTagLabel(rec.tag)}</span>` : '<span class="tag-badge untagged">NO TAG</span>';
        
        // Check if recording is still processing
        const isProcessing = rec.status !== 'ready' || rec.duration === 0;
        const processingBadge = isProcessing ? '<span class="status-badge finalising">FINALISING...</span>' : '';
        const durationDisplay = isProcessing ? 'Processing...' : rec.durationStr;
        
        return `
            <div class="recording-card ${isSelected ? 'selected' : ''} ${isUntagged ? 'untagged' : ''}" 
                 data-asset-id="${rec.assetId}">
                <div class="recording-thumbnail" onclick="openPreview('${rec.assetId}')">
                    <input type="checkbox" class="select-checkbox" 
                           ${isSelected ? 'checked' : ''}
                           onclick="event.stopPropagation(); toggleSelect('${rec.assetId}')">
                    ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${rec.title}" loading="lazy">` : ''}
                    <div class="play-overlay">
                        <div class="play-icon">▶</div>
                    </div>
                    <span class="duration-badge">${durationDisplay}</span>
                    ${processingBadge}
                </div>
                <div class="recording-info">
                    <div class="recording-title" title="${rec.title}">${rec.title || 'Untitled'}</div>
                    <div class="recording-meta">
                        ${tagBadge}
                    </div>
                    <div class="recording-date">
                        <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>${rec.createdFormatted || formatDate(rec.createdAt)}</span>
                    </div>
                </div>
                <div class="recording-actions">
                    <button class="btn btn-edit btn-small" onclick="openEdit('${rec.assetId}')">
                        <svg class="icon" viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                        RENAME
                    </button>
                    <button class="btn btn-download btn-small" onclick="downloadRecording('${rec.assetId}')">
                        <svg class="icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        DOWNLOAD
                    </button>
                    <button class="btn btn-delete btn-small" onclick="openDelete('${rec.assetId}')">
                        <svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        DELETE
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Render List View
    listBody.innerHTML = filteredRecordings.map(rec => {
        const thumbnailUrl = rec.playbackId 
            ? `https://image.mux.com/${rec.playbackId}/thumbnail.jpg?time=10&width=200`
            : '';
        
        const isSelected = selectedRecordings.has(rec.assetId);
        const isUntagged = !rec.tag;
        const tagBadge = rec.tag ? `<span class="tag-badge ${rec.tag}">${getTagLabel(rec.tag)}</span>` : '<span class="tag-badge untagged">NO TAG</span>';
        
        return `
            <tr class="${isSelected ? 'selected' : ''} ${isUntagged ? 'untagged' : ''}" data-asset-id="${rec.assetId}">
                <td class="col-checkbox">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} 
                           onchange="toggleSelect('${rec.assetId}')">
                </td>
                <td class="col-thumb">
                    ${thumbnailUrl ? `<img src="${thumbnailUrl}" class="list-thumbnail" onclick="openPreview('${rec.assetId}')" alt="Preview">` : '-'}
                </td>
                <td class="col-title">
                    <div class="list-title" onclick="openPreview('${rec.assetId}')">${rec.title || 'Untitled'}</div>
                    ${tagBadge}
                </td>
                <td class="col-date">
                    <div class="date-cell">
                        <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        ${rec.createdFormatted || formatDate(rec.createdAt)}
                    </div>
                </td>
                <td class="col-duration">${rec.durationStr}</td>
                <td class="col-actions">
                    <div class="list-actions">
                        <button class="btn btn-edit btn-small" onclick="openEdit('${rec.assetId}')" title="Rename">
                            <svg class="icon" viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                        </button>
                        <button class="btn btn-download btn-small" onclick="downloadRecording('${rec.assetId}')" title="Download">
                            <svg class="icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                        <button class="btn btn-delete btn-small" onclick="openDelete('${rec.assetId}')" title="Delete">
                            <svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getTagLabel(tag) {
    const found = customTags.find(t => t.id === tag);
    if (found) {
        return `${found.icon || ''} ${found.name}`;
    }
    // Fallback for legacy tags
    const labels = {
        'keep': '🟢 Keep',
        'review': '🟡 Review',
        'archive': '📦 Archive'
    };
    return labels[tag] || tag.toUpperCase();
}

/**
 * Get tag color from config
 */
function getTagColor(tagId) {
    const found = customTags.find(t => t.id === tagId);
    return found ? found.color : '#6b7280';
}

/**
 * Get tag info from config
 */
function getTagInfo(tagId) {
    return customTags.find(t => t.id === tagId) || null;
}

function formatDate(timestamp) {
    // Handle null, undefined, 0, or invalid timestamps
    if (!timestamp || timestamp === '0' || timestamp === 0) return '--';
    
    // Parse timestamp - could be Unix seconds, milliseconds, or ISO string
    let date;
    const ts = parseInt(timestamp);
    
    // Check if it's a valid number
    if (isNaN(ts) || ts < 86400) {
        // Less than 1 day in seconds = invalid
        return '--';
    }
    
    // Mux uses Unix seconds, but check if it might be milliseconds
    if (ts > 1000000000000) {
        date = new Date(ts); // Already milliseconds
    } else {
        date = new Date(ts * 1000); // Convert seconds to milliseconds
    }
    
    // Validate the date is reasonable (after year 2000)
    if (date.getFullYear() < 2000 || isNaN(date.getTime())) {
        return '--';
    }
    
    // Check if it's today or yesterday for relative display
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const recordDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const timeStr = date.toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).toLowerCase();
    
    if (recordDate.getTime() === today.getTime()) {
        return `Today, ${timeStr}`;
    } else if (recordDate.getTime() === yesterday.getTime()) {
        return `Yesterday, ${timeStr}`;
    } else {
        // Show full date for older recordings (DD/MM/YYYY format)
        return date.toLocaleString('en-AU', {
            timeZone: 'Australia/Sydney',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).replace(',', '');
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateStats() {
    const totalCount = recordings.filter(r => r.tag !== 'archive').length;
    const totalDuration = recordings.filter(r => r.tag !== 'archive').reduce((sum, r) => sum + (r.duration || 0), 0);
    const selectedCount = selectedRecordings.size;
    const untaggedCount = recordings.filter(r => !r.tag && r.tag !== 'archive').length;
    
    document.getElementById('statTotal').textContent = totalCount;
    document.getElementById('statDuration').textContent = formatDurationLong(totalDuration);
    document.getElementById('statSelected').textContent = selectedCount;
    document.getElementById('statUntagged').textContent = untaggedCount;
}

function formatDurationLong(seconds) {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
}

function showLoading(show) {
    document.getElementById('loadingState').style.display = show ? 'block' : 'none';
    document.getElementById('recordingsGrid').style.display = show ? 'none' : (currentView === 'grid' ? 'grid' : 'none');
    document.getElementById('recordingsList').style.display = show ? 'none' : (currentView === 'list' ? 'block' : 'none');
}

function showEmpty() {
    document.getElementById('recordingsGrid').innerHTML = '';
    document.getElementById('recordingsTableBody').innerHTML = '';
    document.getElementById('emptyState').style.display = 'block';
}

// ============================================
// SELECTION
// ============================================

function toggleSelect(assetId) {
    if (selectedRecordings.has(assetId)) {
        selectedRecordings.delete(assetId);
    } else {
        selectedRecordings.add(assetId);
    }
    
    // Update grid card visual
    const card = document.querySelector(`.recording-card[data-asset-id="${assetId}"]`);
    if (card) {
        card.classList.toggle('selected', selectedRecordings.has(assetId));
        const checkbox = card.querySelector('.select-checkbox');
        if (checkbox) checkbox.checked = selectedRecordings.has(assetId);
    }
    
    // Update list row visual
    const row = document.querySelector(`tr[data-asset-id="${assetId}"]`);
    if (row) {
        row.classList.toggle('selected', selectedRecordings.has(assetId));
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = selectedRecordings.has(assetId);
    }
    
    updateBulkButtons();
    updateSelectAllCheckbox();
}

function toggleSelectAll() {
    // If all are currently selected, deselect all. Otherwise select all.
    const allCurrentlySelected = filteredRecordings.length > 0 && 
        filteredRecordings.every(rec => selectedRecordings.has(rec.assetId));
    
    if (allCurrentlySelected) {
        // Deselect all
        selectedRecordings.clear();
    } else {
        // Select all
        filteredRecordings.forEach(rec => selectedRecordings.add(rec.assetId));
    }
    
    renderRecordings();
    updateBulkButtons();
    updateSelectAllCheckbox();
}

function updateSelectAllCheckbox() {
    const selectAllGrid = document.getElementById('selectAll');
    const selectAllList = document.getElementById('selectAllList');
    const allSelected = filteredRecordings.length > 0 && 
        filteredRecordings.every(rec => selectedRecordings.has(rec.assetId));
    
    if (selectAllGrid) selectAllGrid.checked = allSelected;
    if (selectAllList) selectAllList.checked = allSelected;
}

function updateBulkButtons() {
    const hasSelection = selectedRecordings.size > 0;
    const count = selectedRecordings.size;
    
    // Disable/enable bulk buttons
    document.getElementById('bulkDeleteBtn').disabled = !hasSelection;
    document.getElementById('bulkDownloadBtn').disabled = !hasSelection;
    document.getElementById('batchRenameBtn').disabled = !hasSelection;
    document.getElementById('batchTagBtn').disabled = !hasSelection;
    
    // Update selection count display
    const countDisplay = document.getElementById('selectionCount');
    if (countDisplay) {
        countDisplay.textContent = hasSelection ? `${count} selected` : '';
    }
    
    // Update button labels with counts (using innerHTML for SVG icons)
    const deleteBtn = document.getElementById('bulkDeleteBtn');
    const downloadBtn = document.getElementById('bulkDownloadBtn');
    
    deleteBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete${hasSelection ? ` (${count})` : ''}`;
    downloadBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download${hasSelection ? ` (${count})` : ''}`;
    
    // Update stats to reflect current selection
    document.getElementById('statSelected').textContent = count;
}

// ============================================
// PREVIEW MODAL
// ============================================

function openPreview(assetId) {
    const rec = recordings.find(r => r.assetId === assetId);
    if (!rec || !rec.playbackId) {
        alert('Cannot preview - no playback ID available');
        return;
    }
    
    currentPreviewAsset = rec;
    previewModalOpen = true;
    clipInPoint = null;
    clipOutPoint = null;
    
    // Update modal info
    document.getElementById('previewTitle').textContent = rec.title || 'Preview';
    document.getElementById('previewStream').textContent = rec.streamName || '--';
    document.getElementById('previewDate').textContent = rec.createdFormatted || '--';
    document.getElementById('previewDuration').textContent = rec.durationStr || '--';
    document.getElementById('previewAssetId').textContent = rec.assetId;
    document.getElementById('previewEditTitle').value = rec.title || '';
    document.getElementById('previewNotes').value = rec.notes || '';
    document.getElementById('previewTag').value = rec.tag || '';
    
    // Technical info
    document.getElementById('techPlaybackId').textContent = rec.playbackId || '--';
    document.getElementById('techStreamId').textContent = rec.liveStreamId || '--';
    
    // Setup video player
    const video = document.getElementById('previewVideo');
    const streamUrl = `https://stream.mux.com/${rec.playbackId}.m3u8`;
    
    if (Hls.isSupported()) {
        if (hlsPlayer) {
            hlsPlayer.destroy();
        }
        hlsPlayer = new Hls();
        hlsPlayer.loadSource(streamUrl);
        hlsPlayer.attachMedia(video);
        
        hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
            // Get technical info from HLS
            const levels = hlsPlayer.levels;
            if (levels && levels.length > 0) {
                const best = levels[levels.length - 1];
                document.getElementById('techResolution').textContent = `${best.width}x${best.height}`;
                document.getElementById('techAspect').textContent = (best.width / best.height).toFixed(2) + ':1';
                document.getElementById('techBitrate').textContent = Math.round(best.bitrate / 1000) + ' kbps';
                document.getElementById('techVideoCodec').textContent = best.videoCodec || 'H.264';
                document.getElementById('techAudioCodec').textContent = best.audioCodec || 'AAC';
                document.getElementById('techFrameRate').textContent = (best.frameRate || 25) + ' fps';
            }
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
    }
    
    // Setup scrubber
    setupThumbnailScrubber(rec);
    
    // Load chapters
    loadChapters(rec.assetId);
    
    // Reset tabs
    switchClipTab('info');
    
    // Clear in/out points display
    updateInOutDisplay();
    
    document.getElementById('previewModal').classList.add('show');
}

function closePreview() {
    document.getElementById('previewModal').classList.remove('show');
    previewModalOpen = false;
    
    const video = document.getElementById('previewVideo');
    video.pause();
    
    if (hlsPlayer) {
        hlsPlayer.destroy();
        hlsPlayer = null;
    }
    
    currentPreviewAsset = null;
}

function setPlaybackSpeed() {
    const speed = document.getElementById('playbackSpeed').value;
    document.getElementById('previewVideo').playbackRate = parseFloat(speed);
}

function switchClipTab(tabName) {
    document.querySelectorAll('.clip-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.clip-tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.clip-tab[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// ============================================
// THUMBNAIL SCRUBBER
// ============================================

function setupThumbnailScrubber(rec) {
    const track = document.getElementById('scrubberTrack');
    const preview = document.getElementById('scrubberPreview');
    const thumb = document.getElementById('scrubberThumb');
    const time = document.getElementById('scrubberTime');
    const handle = document.getElementById('scrubberHandle');
    const video = document.getElementById('previewVideo');
    
    // Generate storyboard thumbnails (Mux provides these)
    const baseUrl = `https://image.mux.com/${rec.playbackId}/thumbnail.jpg`;
    
    track.onmousemove = (e) => {
        const rect = track.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const seekTime = percent * rec.duration;
        
        // Update preview position
        preview.style.left = `${e.clientX - rect.left}px`;
        preview.style.display = 'block';
        
        // Load thumbnail for this time
        thumb.src = `${baseUrl}?time=${Math.floor(seekTime)}&width=320`;
        time.textContent = formatTime(seekTime);
    };
    
    track.onmouseleave = () => {
        preview.style.display = 'none';
    };
    
    track.onclick = (e) => {
        const rect = track.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        video.currentTime = percent * rec.duration;
    };
    
    // Update handle position on video timeupdate
    video.ontimeupdate = () => {
        const percent = video.currentTime / video.duration;
        handle.style.left = `${percent * 100}%`;
    };
}

// ============================================
// IN/OUT POINTS
// ============================================

function setInPoint() {
    const video = document.getElementById('previewVideo');
    clipInPoint = video.currentTime;
    
    const marker = document.getElementById('inPointMarker');
    marker.style.display = 'block';
    marker.style.left = `${(clipInPoint / video.duration) * 100}%`;
    
    document.getElementById('inPointTime').value = formatTime(clipInPoint);
    updateInOutDisplay();
    updateTrimButton();
}

function setOutPoint() {
    const video = document.getElementById('previewVideo');
    clipOutPoint = video.currentTime;
    
    const marker = document.getElementById('outPointMarker');
    marker.style.display = 'block';
    marker.style.left = `${(clipOutPoint / video.duration) * 100}%`;
    
    document.getElementById('outPointTime').value = formatTime(clipOutPoint);
    updateInOutDisplay();
    updateTrimButton();
}

function clearInOut() {
    clipInPoint = null;
    clipOutPoint = null;
    
    document.getElementById('inPointMarker').style.display = 'none';
    document.getElementById('outPointMarker').style.display = 'none';
    document.getElementById('inPointTime').value = '';
    document.getElementById('outPointTime').value = '';
    
    updateInOutDisplay();
    updateTrimButton();
}

function goToInPoint() {
    if (clipInPoint !== null) {
        document.getElementById('previewVideo').currentTime = clipInPoint;
    }
}

function goToOutPoint() {
    if (clipOutPoint !== null) {
        document.getElementById('previewVideo').currentTime = clipOutPoint;
    }
}

function updateInOutDisplay() {
    const display = document.getElementById('inOutDisplay');
    const trimDuration = document.getElementById('trimDuration');
    
    if (clipInPoint !== null && clipOutPoint !== null) {
        const duration = clipOutPoint - clipInPoint;
        display.textContent = `${formatTime(clipInPoint)} → ${formatTime(clipOutPoint)} (${formatTime(Math.abs(duration))})`;
        trimDuration.textContent = formatTime(Math.abs(duration));
    } else if (clipInPoint !== null) {
        display.textContent = `In: ${formatTime(clipInPoint)}`;
        trimDuration.textContent = '--';
    } else if (clipOutPoint !== null) {
        display.textContent = `Out: ${formatTime(clipOutPoint)}`;
        trimDuration.textContent = '--';
    } else {
        display.textContent = '--';
        trimDuration.textContent = '--';
    }
}

function updateTrimButton() {
    const btn = document.getElementById('trimBtn');
    btn.disabled = !(clipInPoint !== null && clipOutPoint !== null && clipInPoint < clipOutPoint);
}

async function createTrimmedClip() {
    if (!currentPreviewAsset || clipInPoint === null || clipOutPoint === null) return;
    
    const duration = clipOutPoint - clipInPoint;
    const cost = (duration / 60 * 0.015).toFixed(2);
    
    alert(`Trim: ${formatTime(clipInPoint)} → ${formatTime(clipOutPoint)} (${formatTime(duration)})\n\nMux Clip Creation Pricing:\n• $0.015 per minute of output\n• This clip would cost ~${cost}\n\nTo enable: Contact Scott to enable Mux Video Editing API.`);
}

// ============================================
// CUSTOM THUMBNAIL
// ============================================

function setCustomThumbnail() {
    if (!currentPreviewAsset) return;
    
    const video = document.getElementById('previewVideo');
    const time = Math.floor(video.currentTime);
    
    // Mux generates thumbnails on-the-fly via URL parameters
    // We can't permanently change the default, but we can copy a custom thumbnail URL
    const thumbnailUrl = `https://image.mux.com/${currentPreviewAsset.playbackId}/thumbnail.jpg?time=${time}&width=1280`;
    
    navigator.clipboard.writeText(thumbnailUrl).then(() => {
        alert(`Custom thumbnail URL copied!\n\nTime: ${formatTime(time)}\n\nUse this URL wherever you need this frame as a thumbnail.`);
    }).catch(() => {
        // Fallback - show URL in prompt
        prompt('Custom thumbnail URL (copy this):', thumbnailUrl);
    });
}

// ============================================
// CHAPTERS
// ============================================

function loadChapters(assetId) {
    const chapters = clipChapters[assetId] || [];
    renderChapters(chapters);
}

function renderChapters(chapters) {
    const list = document.getElementById('chaptersList');
    const markers = document.getElementById('chapterMarkers');
    const video = document.getElementById('previewVideo');
    
    if (chapters.length === 0) {
        list.innerHTML = '<p class="empty-hint">No chapters yet. Click "Add Chapter" while playing to mark a moment.</p>';
        markers.innerHTML = '';
        return;
    }
    
    list.innerHTML = chapters.map((ch, i) => `
        <div class="chapter-item">
            <span class="chapter-time" onclick="seekToChapter(${ch.time})">${formatTime(ch.time)}</span>
            <span class="chapter-name">
                <input type="text" value="${ch.name}" onchange="updateChapterName(${i}, this.value)">
            </span>
            <button class="btn btn-small btn-danger" onclick="deleteChapter(${i})">✕</button>
        </div>
    `).join('');
    
    // Render markers on timeline
    if (currentPreviewAsset) {
        markers.innerHTML = chapters.map(ch => {
            const percent = (ch.time / currentPreviewAsset.duration) * 100;
            return `<div class="chapter-marker" style="left: ${percent}%"></div>`;
        }).join('');
    }
}

function addChapterAtCurrentTime() {
    if (!currentPreviewAsset) return;
    
    const video = document.getElementById('previewVideo');
    const time = video.currentTime;
    const name = prompt('Chapter name:', `Chapter ${(clipChapters[currentPreviewAsset.assetId]?.length || 0) + 1}`);
    
    if (!name) return;
    
    if (!clipChapters[currentPreviewAsset.assetId]) {
        clipChapters[currentPreviewAsset.assetId] = [];
    }
    
    clipChapters[currentPreviewAsset.assetId].push({ time, name });
    clipChapters[currentPreviewAsset.assetId].sort((a, b) => a.time - b.time);
    
    renderChapters(clipChapters[currentPreviewAsset.assetId]);
    saveChapters();
}

function seekToChapter(time) {
    document.getElementById('previewVideo').currentTime = time;
}

function updateChapterName(index, name) {
    if (!currentPreviewAsset) return;
    clipChapters[currentPreviewAsset.assetId][index].name = name;
    saveChapters();
}

function deleteChapter(index) {
    if (!currentPreviewAsset) return;
    clipChapters[currentPreviewAsset.assetId].splice(index, 1);
    renderChapters(clipChapters[currentPreviewAsset.assetId]);
    saveChapters();
}

async function saveChapters() {
    // Save to local storage for now (could be saved to backend)
    localStorage.setItem('clipChapters', JSON.stringify(clipChapters));
}

// Load chapters from localStorage on init
try {
    const saved = localStorage.getItem('clipChapters');
    if (saved) clipChapters = JSON.parse(saved);
} catch (e) {}

// ============================================
// COPY URL / EMBED / SHARE
// ============================================

function copyPlaybackUrl() {
    if (!currentPreviewAsset) return;
    
    const url = `https://stream.mux.com/${currentPreviewAsset.playbackId}.m3u8`;
    navigator.clipboard.writeText(url);
    alert('HLS URL copied to clipboard!');
}

function openEmbedCode() {
    if (!currentPreviewAsset) return;
    updateEmbedCode();
    document.getElementById('embedModal').classList.add('show');
}

function closeEmbed() {
    document.getElementById('embedModal').classList.remove('show');
}

function updateEmbedCode() {
    if (!currentPreviewAsset) return;
    
    const size = document.getElementById('embedSize').value;
    const playbackId = currentPreviewAsset.playbackId;
    
    let code;
    if (size === 'responsive') {
        code = `<div style="position: relative; padding-top: 56.25%;">
  <iframe src="https://stream.mux.com/${playbackId}.m3u8" 
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
    frameborder="0" allowfullscreen>
  </iframe>
</div>`;
    } else {
        const [w, h] = size.split('x');
        code = `<iframe src="https://stream.mux.com/${playbackId}.m3u8" 
  width="${w}" height="${h}" 
  frameborder="0" allowfullscreen>
</iframe>`;
    }
    
    document.getElementById('embedCode').value = code;
}

function copyEmbedCode() {
    const code = document.getElementById('embedCode').value;
    navigator.clipboard.writeText(code);
    alert('Embed code copied!');
    closeEmbed();
}

function openShareLink() {
    if (!currentPreviewAsset) return;
    
    // Generate share URL (uses Mux's public playback)
    const url = `https://stream.mux.com/${currentPreviewAsset.playbackId}.m3u8`;
    document.getElementById('shareUrl').value = url;
    document.getElementById('shareModal').classList.add('show');
}

function closeShare() {
    document.getElementById('shareModal').classList.remove('show');
}

function copyShareLink() {
    const url = document.getElementById('shareUrl').value;
    navigator.clipboard.writeText(url);
    alert('Share link copied!');
    closeShare();
}

// ============================================
// UPDATE CLIP (from preview modal)
// ============================================

async function updateClipTitle() {
    if (!currentPreviewAsset) return;
    const title = document.getElementById('previewEditTitle').value.trim();
    await updateRecording(currentPreviewAsset.assetId, { title });
}

async function updateClipNotes() {
    if (!currentPreviewAsset) return;
    const notes = document.getElementById('previewNotes').value.trim();
    await updateRecording(currentPreviewAsset.assetId, { notes });
}

async function updateClipTag() {
    if (!currentPreviewAsset) return;
    const tag = document.getElementById('previewTag').value;
    await updateRecording(currentPreviewAsset.assetId, { tag });
}

async function updateRecording(assetId, updates) {
    try {
        const response = await fetch('/api/recordings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update',
                assetId,
                ...updates
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update local data
            const rec = recordings.find(r => r.assetId === assetId);
            if (rec) {
                Object.assign(rec, updates);
            }
            renderRecordings();
        }
    } catch (error) {
        console.error('Error updating recording:', error);
    }
}

// ============================================
// DOWNLOAD
// ============================================

/**
 * Generate download filename from recording data
 * Format: {LivestreamName}-{DD-MM-YY}_{HH-MM}.mp4
 */
function generateDownloadFilename(rec) {
    // Get stream name (or fallback)
    let name = rec.streamName || rec.title || 'Recording';
    
    // Convert spaces to hyphens, remove special chars
    name = name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
    
    // Get date and time from createdAt timestamp
    let dateTimeStr = 'Unknown-Date';
    if (rec.createdAt && rec.createdAt !== '0') {
        const ts = parseInt(rec.createdAt);
        const date = ts > 1000000000000 ? new Date(ts) : new Date(ts * 1000);
        if (!isNaN(date.getTime()) && date.getFullYear() > 2000) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = String(date.getFullYear()).slice(-2);
            const hours = String(date.getHours()).padStart(2, '0');
            const mins = String(date.getMinutes()).padStart(2, '0');
            dateTimeStr = `${day}-${month}-${year}_${hours}-${mins}`;
        }
    }
    
    return `${name}-${dateTimeStr}.mp4`;
}

async function downloadRecording(assetId) {
    const rec = recordings.find(r => r.assetId === assetId);
    const filename = rec ? generateDownloadFilename(rec) : `recording-${assetId}.mp4`;
    
    const modal = document.getElementById('downloadModal');
    const status = document.getElementById('downloadStatus');
    const progress = document.getElementById('downloadProgress');
    
    modal.classList.add('show');
    status.textContent = 'Requesting download URL from Mux...';
    progress.style.width = '30%';
    
    try {
        const response = await fetch(`/api/recordings?action=download&assetId=${assetId}`);
        const data = await response.json();
        
        if (data.success && data.downloadUrl) {
            status.innerHTML = `Downloading: <strong>${filename}</strong>`;
            progress.style.width = '100%';
            
            // Create download link with proper filename
            const link = document.createElement('a');
            link.href = data.downloadUrl;
            link.download = filename;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Show filename reminder (in case browser ignores download attribute)
            setTimeout(() => {
                status.innerHTML = `Save as: <strong>${filename}</strong>`;
            }, 500);
            
            setTimeout(() => {
                modal.classList.remove('show');
            }, 3000);
        } else {
            throw new Error(data.error || 'Failed to get download URL');
        }
    } catch (error) {
        console.error('Download error:', error);
        status.textContent = 'Error: ' + error.message;
        progress.style.width = '0%';
        
        setTimeout(() => {
            modal.classList.remove('show');
        }, 3000);
    }
}

function downloadFromPreview() {
    if (currentPreviewAsset) {
        downloadRecording(currentPreviewAsset.assetId);
    }
}

async function bulkDownload() {
    if (selectedRecordings.size === 0) return;
    
    const assetIds = Array.from(selectedRecordings);
    
    for (let i = 0; i < assetIds.length; i++) {
        await downloadRecording(assetIds[i]);
        if (i < assetIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }
}

// ============================================
// BATCH RENAME
// ============================================

function openBatchRename() {
    if (selectedRecordings.size === 0) return;
    
    document.getElementById('batchRenameCount').textContent = selectedRecordings.size;
    document.getElementById('renamePattern').value = '{stream} - Session {n}';
    updateRenamePreview();
    document.getElementById('batchRenameModal').classList.add('show');
}

function closeBatchRename() {
    document.getElementById('batchRenameModal').classList.remove('show');
}

function updateRenamePreview() {
    const pattern = document.getElementById('renamePattern').value;
    const preview = document.getElementById('renamePreview');
    
    const selectedRecs = recordings.filter(r => selectedRecordings.has(r.assetId));
    
    preview.innerHTML = selectedRecs.slice(0, 5).map((rec, i) => {
        const name = pattern
            .replace('{n}', String(i + 1).padStart(3, '0'))
            .replace('{stream}', rec.streamName || 'Unknown')
            .replace('{date}', rec.createdFormatted?.split(',')[0] || '');
        return `<div>${name}</div>`;
    }).join('') + (selectedRecs.length > 5 ? `<div>... and ${selectedRecs.length - 5} more</div>` : '');
}

async function applyBatchRename() {
    const pattern = document.getElementById('renamePattern').value;
    const selectedRecs = recordings.filter(r => selectedRecordings.has(r.assetId));
    
    for (let i = 0; i < selectedRecs.length; i++) {
        const rec = selectedRecs[i];
        const title = pattern
            .replace('{n}', String(i + 1).padStart(3, '0'))
            .replace('{stream}', rec.streamName || 'Unknown')
            .replace('{date}', rec.createdFormatted?.split(',')[0] || '');
        
        await updateRecording(rec.assetId, { title });
    }
    
    closeBatchRename();
    renderRecordings();
    alert(`Renamed ${selectedRecs.length} clips`);
}

// ============================================
// BATCH TAG
// ============================================

function openBatchTag() {
    if (selectedRecordings.size === 0) return;
    
    document.getElementById('batchTagCount').textContent = selectedRecordings.size;
    
    // Populate dynamic tag buttons
    const container = document.getElementById('batchTagOptions');
    if (container) {
        container.innerHTML = customTags.map(tag => `
            <button class="tag-btn" style="--tag-color: ${tag.color}" onclick="applyBatchTag('${tag.id}')">
                ${tag.icon || ''} ${tag.name}
            </button>
        `).join('') + `
            <button class="tag-btn tag-btn-clear" onclick="applyBatchTag('')">❌ Clear Tag</button>
        `;
    }
    
    document.getElementById('batchTagModal').classList.add('show');
}

function closeBatchTag() {
    document.getElementById('batchTagModal').classList.remove('show');
}

async function applyBatchTag(tag) {
    const selectedRecs = recordings.filter(r => selectedRecordings.has(r.assetId));
    
    for (const rec of selectedRecs) {
        await updateRecording(rec.assetId, { tag });
    }
    
    closeBatchTag();
    applyFiltersAndSort();
    alert(`Tagged ${selectedRecs.length} clips as ${tag || 'untagged'}`);
}

// ============================================
// EDIT MODAL
// ============================================

function openEdit(assetId) {
    const rec = recordings.find(r => r.assetId === assetId);
    if (!rec) return;
    
    currentEditAsset = rec;
    
    document.getElementById('editTitle').value = rec.title || '';
    document.getElementById('editExternalId').value = rec.externalId || '';
    document.getElementById('editNotes').value = rec.notes || '';
    
    document.getElementById('editModal').classList.add('show');
}

function closeEdit() {
    document.getElementById('editModal').classList.remove('show');
    currentEditAsset = null;
}

async function saveEdit() {
    if (!currentEditAsset) return;
    
    const title = document.getElementById('editTitle').value.trim();
    const externalId = document.getElementById('editExternalId').value.trim();
    const notes = document.getElementById('editNotes').value.trim();
    
    try {
        const response = await fetch('/api/recordings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update',
                assetId: currentEditAsset.assetId,
                title,
                externalId,
                notes
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const rec = recordings.find(r => r.assetId === currentEditAsset.assetId);
            if (rec) {
                rec.title = title;
                rec.externalId = externalId;
                rec.notes = notes;
            }
            
            closeEdit();
            renderRecordings();
        } else {
            throw new Error(data.error || 'Failed to save');
        }
    } catch (error) {
        console.error('Save error:', error);
        alert('Failed to save: ' + error.message);
    }
}

// ============================================
// DELETE
// ============================================

function openDelete(assetId) {
    const rec = recordings.find(r => r.assetId === assetId);
    if (!rec) return;
    
    currentDeleteAsset = rec;
    document.getElementById('deleteTitle').textContent = rec.title || rec.assetId;
    document.getElementById('deleteModal').classList.add('show');
}

function closeDelete() {
    document.getElementById('deleteModal').classList.remove('show');
    currentDeleteAsset = null;
}

async function confirmDelete() {
    if (!currentDeleteAsset) return;
    
    try {
        const response = await fetch('/api/recordings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'delete',
                assetId: currentDeleteAsset.assetId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            recordings = recordings.filter(r => r.assetId !== currentDeleteAsset.assetId);
            selectedRecordings.delete(currentDeleteAsset.assetId);
            
            closeDelete();
            applyFiltersAndSort();
            updateStats();
        } else {
            throw new Error(data.error || 'Failed to delete');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete: ' + error.message);
    }
}

async function bulkDelete() {
    if (selectedRecordings.size === 0) return;
    
    const count = selectedRecordings.size;
    if (!confirm(`Are you sure you want to delete ${count} recording(s)? This cannot be undone.`)) {
        return;
    }
    
    const assetIds = Array.from(selectedRecordings);
    let deleted = 0;
    let failed = 0;
    
    for (const assetId of assetIds) {
        try {
            const response = await fetch('/api/recordings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete',
                    assetId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                recordings = recordings.filter(r => r.assetId !== assetId);
                selectedRecordings.delete(assetId);
                deleted++;
            } else {
                failed++;
            }
        } catch (error) {
            failed++;
        }
    }
    
    applyFiltersAndSort();
    updateStats();
    
    if (failed > 0) {
        alert(`Deleted ${deleted} recording(s). ${failed} failed.`);
    }
}

// ============================================
// EXPORT
// ============================================

function exportCSV() {
    const data = filteredRecordings.map(rec => ({
        'Title': rec.title || '',
        'Stream': rec.streamName || '',
        'Date': rec.createdFormatted || '',
        'Duration': rec.durationStr || '',
        'Duration (seconds)': rec.duration || 0,
        'Tag': rec.tag || '',
        'Notes': rec.notes || '',
        'Asset ID': rec.assetId || '',
        'Playback ID': rec.playbackId || '',
        'External ID': rec.externalId || '',
        'Status': rec.status || ''
    }));
    
    if (data.length === 0) {
        alert('No recordings to export');
        return;
    }
    
    const headers = Object.keys(data[0]);
    const rows = [
        headers.join(','),
        ...data.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))
    ];
    
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `yabun-recordings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
}

function exportFinalCutXML() {
    const data = filteredRecordings;
    
    if (data.length === 0) {
        alert('No recordings to export');
        return;
    }
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
    <resources>
`;
    
    data.forEach((rec, i) => {
        const duration = Math.round((rec.duration || 0) * 1000);
        xml += `        <asset id="r${i+1}" name="${escapeXml(rec.title || rec.assetId)}" duration="${duration}/1000s" hasVideo="1" hasAudio="1">
            <media-rep kind="original-media" src="https://stream.mux.com/${rec.playbackId}.m3u8"/>
        </asset>
`;
    });
    
    xml += `    </resources>
    <library>
        <event name="Yabun 2025 Recordings">
`;
    
    data.forEach((rec, i) => {
        xml += `            <clip name="${escapeXml(rec.title || rec.assetId)}" ref="r${i+1}"/>
`;
    });
    
    xml += `        </event>
    </library>
</fcpxml>`;
    
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `yabun-recordings-${new Date().toISOString().split('T')[0]}.fcpxml`;
    a.click();
    
    URL.revokeObjectURL(url);
}

function escapeXml(str) {
    return str.replace(/[<>&'"]/g, c => ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;'
    }[c]));
}
