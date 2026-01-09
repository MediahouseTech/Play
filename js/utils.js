/**
 * UTILS.JS - Mediahouse Crew Dashboard
 * Helper functions for clipboard, SMS, and general utilities
 * 
 * TROUBLESHOOTING:
 * - Copy not working? Check HTTPS is enabled (required for Clipboard API)
 * - SMS not opening? Check iOS vs Android URL format
 */

/**
 * Copy text to clipboard with visual feedback
 * Falls back to execCommand for older browsers
 */
async function copyToClipboard(text, buttonElement) {
    try {
        await navigator.clipboard.writeText(text);
        showCopySuccess(buttonElement);
    } catch (err) {
        // Fallback for older browsers or HTTP contexts
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showCopySuccess(buttonElement);
        } catch (e) {
            console.error('Copy failed:', e);
            showCopyError(buttonElement);
        }
        document.body.removeChild(textarea);
    }
}

function showCopySuccess(buttonElement) {
    const originalText = buttonElement.textContent;
    buttonElement.textContent = '✓ Copied';
    buttonElement.classList.add('copy-success');
    setTimeout(() => {
        buttonElement.textContent = originalText;
        buttonElement.classList.remove('copy-success');
    }, 2000);
}

function showCopyError(buttonElement) {
    const originalText = buttonElement.textContent;
    buttonElement.textContent = '✗ Failed';
    buttonElement.classList.add('copy-error');
    setTimeout(() => {
        buttonElement.textContent = originalText;
        buttonElement.classList.remove('copy-error');
    }, 2000);
}

/**
 * Share dashboard URL via SMS
 * Detects iOS vs Android for correct URL format
 */
function shareViaSMS(eventName) {
    const message = encodeURIComponent(
        `Monitor the ${eventName} livestream:\n${window.location.href}`
    );
    
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (iOS) {
        window.location.href = `sms:&body=${message}`;
    } else {
        window.location.href = `sms:?body=${message}`;
    }
}

/**
 * Format duration from seconds to HH:MM:SS
 */
function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format bitrate to human readable
 */
function formatBitrate(bps) {
    if (bps >= 1000000) {
        return (bps / 1000000).toFixed(1) + ' Mbps';
    }
    return (bps / 1000).toFixed(0) + ' Kbps';
}

/**
 * Save preferences to localStorage
 */
function savePreferences(prefs) {
    localStorage.setItem('crewDashboardPrefs', JSON.stringify(prefs));
}

/**
 * Load preferences from localStorage
 */
function loadPreferences() {
    const saved = localStorage.getItem('crewDashboardPrefs');
    return saved ? JSON.parse(saved) : null;
}
