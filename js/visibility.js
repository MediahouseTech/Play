/**
 * VISIBILITY.JS - Mediahouse Crew Dashboard
 * Handles page visibility for battery/data saving on mobile
 * 
 * HOW IT WORKS:
 * - When user locks phone or switches tabs, streams pause
 * - When user returns, streams resume at live edge (no time-shift)
 * - VU meters also pause to save CPU
 * 
 * TROUBLESHOOTING:
 * - Not pausing? Check event listener is on 'document'
 * - Not resuming live? Mux live streams should auto-seek to live edge
 * - Safari different? Yes, test specifically in Safari
 */

let visibilityHandlers = {
    onHide: [],
    onShow: []
};

/**
 * Initialize page visibility handling
 * Call this once on page load
 */
function initVisibilityHandling() {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    console.log('[Visibility] Handler initialized');
}

/**
 * Handle visibility state changes
 */
function handleVisibilityChange() {
    if (document.hidden) {
        console.log('[Visibility] Page hidden - pausing streams');
        visibilityHandlers.onHide.forEach(handler => handler());
    } else {
        console.log('[Visibility] Page visible - resuming streams');
        visibilityHandlers.onShow.forEach(handler => handler());
    }
}

/**
 * Register a callback for when page is hidden
 */
function onPageHide(callback) {
    visibilityHandlers.onHide.push(callback);
}

/**
 * Register a callback for when page becomes visible
 */
function onPageShow(callback) {
    visibilityHandlers.onShow.push(callback);
}

/**
 * Pause all Mux players
 */
function pauseAllPlayers() {
    const players = document.querySelectorAll('mux-player');
    players.forEach(player => {
        if (player && typeof player.pause === 'function') {
            player.pause();
        }
    });
}

/**
 * Resume all Mux players at live edge
 */
function resumeAllPlayersLive() {
    const players = document.querySelectorAll('mux-player');
    players.forEach(player => {
        if (player) {
            // Jump to live edge for live streams
            if (player.streamType === 'live' || player.streamType === 'll-live') {
                // Setting currentTime to Infinity or duration seeks to live edge
                player.currentTime = Infinity;
            }
            if (typeof player.play === 'function') {
                player.play().catch(e => {
                    // Autoplay may be blocked, user will need to tap
                    console.log('[Visibility] Play blocked, user interaction needed');
                });
            }
        }
    });
}
