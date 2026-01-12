# PLAY - System Architecture

## Overview

**Play** is a Mediahouse crew monitoring dashboard for live streaming events. It provides real-time stream status, VU meters, break mode controls, and a comprehensive recordings manager.

**Live URL:** https://play.mediahouse.com.au (production)
**Netlify Site:** play-mediahouse
**Repository:** /Users/m4server/Documents/play

---

## System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PLAY DASHBOARD                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  index.html  │  │recordings.html│  │   Settings   │               │
│  │  Live View   │  │  VOD Manager │  │    Modal     │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                 │                        │
│  ┌──────┴─────────────────┴─────────────────┴───────┐               │
│  │                    JavaScript                     │               │
│  │  app.js | recordings.js | settings.js | vu-meter.js              │
│  └──────────────────────┬───────────────────────────┘               │
│                         │                                            │
└─────────────────────────┼────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     NETLIFY FUNCTIONS (API)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  /api/config          GET/POST dashboard configuration               │
│  /api/stream-status   GET live stream status from Mux               │
│  /api/break-mode      GET/POST break mode state per stream          │
│  /api/mux-webhook     POST receives Mux webhook events              │
│  /api/recordings      GET/POST manage recordings index              │
│  /api/debug-mux       GET debug Mux connection                      │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  NETLIFY BLOBS   │ │     MUX API      │ │  AUDIO WEBSOCKET │
│                  │ │                  │ │                  │
│ • config         │ │ • Live Streams   │ │ audio-ws.        │
│ • break-mode     │ │ • Assets/VODs    │ │ mediahouse.com.au│
│ • encoder-states │ │ • Playback IDs   │ │                  │
│ • recordings-idx │ │ • Stream Keys    │ │ Server-side VU   │
│                  │ │ • Webhooks       │ │ meter analysis   │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## Data Flow

### 1. Live Stream Monitoring

```
Encoder (OBS/LiveU) → Mux Ingest → Mux CDN → HLS.js Player → Dashboard
                           │
                           ▼
                    Mux Webhooks ────→ /api/mux-webhook ────→ Netlify Blobs
                                                                   │
                                                                   ▼
                    Dashboard polls /api/stream-status ←──── encoder-states
```

### 2. VU Meters (Server-Side)

```
Mux HLS Stream → audio-ws.mediahouse.com.au (FFmpeg) → WebSocket → Dashboard
                         │
                         ├── Decodes HLS audio
                         ├── Analyzes levels (LUFS + Peak)
                         └── Broadcasts via WebSocket
```

### 3. Break Mode

```
Producer clicks "BREAK" → /api/break-mode POST → Netlify Blobs
                                                      │
All viewers poll /api/break-mode GET ←────────────────┘
                                                      │
                          Dashboard shows fallback video or "ON BREAK" state
```

---

## File Structure

```
/Users/m4server/Documents/play/
├── index.html              # Main live dashboard
├── recordings.html         # Recordings manager
├── config.json             # Local fallback config
├── package.json            # Dependencies
├── netlify.toml            # Netlify build + redirects
│
├── css/
│   ├── dashboard.css       # Main dashboard styles
│   └── recordings.css      # Recordings manager styles
│
├── js/
│   ├── app.js              # Main application logic
│   ├── settings.js         # Settings modal, break mode UI
│   ├── recordings.js       # Recordings manager logic
│   ├── vu-meter.js         # VU meter WebSocket client
│   ├── utils.js            # Helpers (copy, SMS, etc.)
│   └── visibility.js       # Page visibility handling
│
├── netlify/functions/
│   ├── config.mjs          # Dashboard configuration CRUD
│   ├── stream-status.mjs   # Mux API status + encoder states
│   ├── break-mode.mjs      # Break mode state management
│   ├── mux-webhook.mjs     # Mux webhook receiver
│   ├── recordings.mjs      # Recordings index management
│   └── debug-mux.mjs       # Debug endpoint
│
├── images/
│   └── poster.jpg          # Default poster image
│
├── lib/
│   └── hls.min.js          # HLS.js player library
│
└── support-docs/           # Documentation (this folder)
```

---

## Key Technologies

| Component | Technology | Purpose |
|-----------|------------|---------|
| Hosting | Netlify | Static hosting + serverless functions |
| Storage | Netlify Blobs | Persistent key-value storage |
| Video | Mux | Live streaming + VOD + recordings |
| Player | HLS.js | Adaptive bitrate video playback |
| VU Meters | WebSocket + FFmpeg | Real-time audio analysis |
| Styling | CSS Grid + Flexbox | Responsive dark theme |

---

## Environment Variables (Netlify)

| Variable | Purpose |
|----------|---------|
| `MUX_TOKEN_ID` | Mux API authentication |
| `MUX_TOKEN_SECRET` | Mux API authentication |
| `MUX_WEBHOOK_SECRET` | Webhook signature verification |

---

## External Dependencies

### Mux (video infrastructure)
- Live stream creation and management
- HLS video delivery via CDN
- Recording storage and playback
- Webhooks for stream events

### Audio WebSocket Server
- Location: audio-ws.mediahouse.com.au
- Runs on Proxmox infrastructure (BlueHaze Lab)
- Analyzes Mux HLS streams server-side
- Broadcasts LUFS + Peak levels via WebSocket

---

## Security Model

1. **Producer Password** - Settings access requires password (default: `Live2Stream`)
2. **Session Storage** - Authentication persists per browser session
3. **Mux API Keys** - Stored in Netlify environment variables, never exposed to client
4. **Webhook Verification** - Mux webhooks verified via signature (when configured)
