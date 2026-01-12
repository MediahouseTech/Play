# PLAY - Coding Patterns & Conventions

## File Organization

```
play/
├── index.html          # Main dashboard (multi-stream view)
├── recordings.html     # Recording manager (standalone page)
├── config.json         # Local fallback config (not used in production)
│
├── css/
│   ├── dashboard.css   # Styles for index.html
│   └── recordings.css  # Styles for recordings.html
│
├── js/
│   ├── app.js          # Main dashboard logic
│   ├── settings.js     # Settings modal + break mode UI
│   ├── recordings.js   # Recording manager logic
│   ├── vu-meter.js     # VU meter WebSocket client
│   ├── utils.js        # Shared utilities
│   └── visibility.js   # Page visibility handling
│
├── netlify/functions/  # Serverless API endpoints
│   ├── config.mjs
│   ├── stream-status.mjs
│   ├── break-mode.mjs
│   ├── mux-webhook.mjs
│   ├── recordings.mjs
│   └── debug-mux.mjs
│
└── support-docs/       # Documentation
```

---

## JavaScript Patterns

### Module Pattern

Each JS file is a module with clear responsibilities:

```javascript
// settings.js example
let settingsConfig = null;          // Module-level state
let isProducerAuthenticated = false;

function initSettings(config) {     // Initialization function
    settingsConfig = config;
    checkExistingSession();
}

function openSettings() { }          // Public functions
function closeSettings() { }
function saveSettings() { }
```

### Async/Await for API Calls

Always use async/await, never raw promises:

```javascript
// ✅ Good
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[Config] Load failed:', error);
        return null;
    }
}

// ❌ Bad
function loadConfig() {
    return fetch('/api/config')
        .then(r => r.json())
        .then(data => data)
        .catch(err => null);
}
```

### Console Logging Convention

Use prefixes for easy filtering:

```javascript
console.log('[App] Dashboard initialized');
console.log('[Settings] Config saved');
console.log('[VU] WebSocket connected');
console.error('[Recordings] Fetch failed:', error);
```

### Error Handling

Always wrap API calls in try/catch:

```javascript
async function saveSettings() {
    const saveBtn = document.getElementById('saveSettingsBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        if (!response.ok) throw new Error('Save failed');
        
        saveBtn.textContent = '✓ Saved!';
    } catch (error) {
        console.error('[Settings] Save failed:', error);
        saveBtn.textContent = '✗ Failed';
    } finally {
        setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Save Settings';
        }, 2000);
    }
}
```

---

## CSS Patterns

### Dark Theme Variables

```css
:root {
    --bg-dark: #1a1a2e;
    --bg-card: #16213e;
    --bg-input: #0f0f23;
    --text-primary: #ffffff;
    --text-secondary: #a0a0a0;
    --accent-blue: #00d4ff;
    --accent-green: #00ff88;
    --accent-red: #ff4757;
    --accent-yellow: #ffa502;
}
```

### Component Classes

Use BEM-like naming:

```css
.stream-card { }
.stream-card__header { }
.stream-card__status { }
.stream-card--offline { }
.stream-card--live { }
```

### Status Colors

```css
.status-live { color: #00ff88; }
.status-offline { color: #ff4757; }
.status-idle { color: #ffa502; }
.status-break { color: #ff9f43; }
```

### Responsive Breakpoints

```css
/* Mobile first */
.stream-grid {
    grid-template-columns: 1fr;
}

/* Tablet */
@media (min-width: 768px) {
    .stream-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

/* Desktop */
@media (min-width: 1200px) {
    .stream-grid {
        grid-template-columns: repeat(4, 1fr);
    }
}
```

---

## Netlify Functions Patterns

### Standard Response Format

```javascript
// Success
return new Response(JSON.stringify({
    success: true,
    data: { ... }
}), { 
    status: 200, 
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    }
});

// Error
return new Response(JSON.stringify({
    success: false,
    error: 'Description of what went wrong'
}), { 
    status: 400,  // or 500 for server errors
    headers: { ... }
});
```

### CORS Handling

Every function needs CORS headers:

```javascript
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
};

// Handle preflight
if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
}
```

### Netlify Blobs Usage

```javascript
import { getStore } from "@netlify/blobs";

export default async function handler(request, context) {
    const store = getStore("yabun-dashboard");
    
    // Read
    const config = await store.get("config", { type: "json" });
    
    // Write
    await store.setJSON("config", newConfig);
    
    // Delete
    await store.delete("config");
}
```

### Mux API Authentication

```javascript
const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID;
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET;

const auth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');

const response = await fetch('https://api.mux.com/video/v1/...', {
    headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
    }
});
```

---

## HTML Patterns

### Modal Structure

```html
<div id="exampleModal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h2>Modal Title</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <!-- Content -->
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="saveModal()">Save</button>
        </div>
    </div>
</div>
```

### Button Styles

```html
<button class="btn btn-primary">Primary Action</button>
<button class="btn btn-secondary">Secondary</button>
<button class="btn btn-danger">Delete</button>
<button class="btn btn-small">Small Button</button>
```

### Form Inputs

```html
<div class="form-group">
    <label for="eventName">Event Name</label>
    <input type="text" id="eventName" class="input-field" placeholder="Enter event name">
</div>
```

---

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| HTML IDs | camelCase | `eventName`, `saveBtn` |
| CSS classes | kebab-case | `stream-card`, `btn-primary` |
| JS variables | camelCase | `isAuthenticated`, `streamConfig` |
| JS constants | UPPER_SNAKE | `AUTH_SESSION_KEY`, `MUX_TOKEN_ID` |
| Functions | camelCase, verb first | `loadConfig()`, `saveSettings()` |
| Files | kebab-case | `stream-status.mjs`, `vu-meter.js` |
| Netlify functions | kebab-case | `break-mode.mjs`, `mux-webhook.mjs` |

---

## Safari Compatibility Notes

Safari has quirks. Always test in Safari:

1. **WebKit prefix for CSS:** Some properties need `-webkit-` prefix
2. **HLS native support:** Safari plays HLS natively, no HLS.js needed
3. **Web Audio API:** More restrictive, won't work cross-origin
4. **Date parsing:** Use `new Date(timestamp * 1000)` not string parsing
