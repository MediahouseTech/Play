# PLAY - Feature List

**Version:** 2.5  
**Last Updated:** January 2026  
**Product:** Mediahouse Crew Monitoring Dashboard

---

## Overview

PLAY is a professional-grade livestream monitoring dashboard designed for broadcast crews. It provides real-time stream monitoring, audio metering, break mode controls, and comprehensive recording management for multi-stream live events.

---

## Core Dashboard Features

### Multi-Stream Monitoring
- **1-4 simultaneous streams** with independent status tracking
- **HLS.js video playback** with adaptive bitrate
- **Grid view** (2x2) for monitoring all streams at once
- **Single-stream view** - click stream name to expand (ESC to return)
- **Poster images** displayed when streams are offline

### Stream Status Detection
- **Real-time encoder status** via Mux webhooks
- **Instant disconnect detection** - no polling delay
- **Live/Offline/Idle states** with visual indicators
- **Automatic reconnection** when encoder comes back online

### Audio Monitoring
- **Per-stream audio toggle** - click speaker icon to hear audio
- **Exclusive playback** - only one stream plays audio at a time
- **VU Meters** with LUFS and Peak levels
- **Server-side audio analysis** via WebSocket (works on Safari/Brave)
- **Real-time visual feedback** with broadcast-style meters

### Quality Controls
- **Bandwidth presets**: LOW (480p), MED (720p), HIGH (1080p)
- **Monitor scaling**: 75%, 100%, 110%, 125%, 150%, 175%
- **Bitrate display** per stream
- **Duration counter** showing stream uptime

---

## Break Mode System

### Per-Stream Break Controls
- **Individual break buttons** for each stream
- **Dual break video support** (Break 1 / Break 2 per stream)
- **GO LIVE button** to return from break
- **Visual break state indicator** on each monitor

### Break Video Library
- **Up to 4 break videos** configurable in Settings
- **Named videos** with thumbnails for easy identification
- **Per-stream video assignment** - assign different break videos to different streams
- **Smooth transitions** between live and break content

### Viewer Experience
- **Seamless switching** - viewers see break video, not frozen frame
- **Configurable transitions**: Crossfade or Fade Through Black
- **Adjustable duration**: 0.5s, 1s, or 1.5s

---

## Producer Tools

### Settings Panel (Password Protected)
- **Event information** editing (name, date, times, contacts)
- **Stream configuration** (Playback ID, Stream Key, Live Stream ID)
- **Break video library** management
- **Display options** (show/hide VU meters, duration, bitrate, viewers)
- **Dashboard expiry date** setting
- **Password management**

### Mux Integration
- **Slate image sync** - one-click upload to all Mux livestreams
- **Poster image sync** - standardized naming (poster-1.jpg, slate-1.jpg)
- **Stream status API** integration
- **Webhook-based encoder detection**

### Sharing & Communication
- **SMS share** functionality for dashboard URL
- **WhatsApp group link** in Event Info
- **Producer contact details** display

---

## Recording Manager

### Recording Library
- **Grid and list views** for browsing recordings
- **Search and filter** by title, stage, or tag
- **Stage-based filtering** (recordings linked to source stream)
- **Thumbnail previews** from Mux

### Tagging System
- **Custom tags** (Keep, Review, Archive, or custom)
- **Tag colors and icons** configurable in Settings
- **Batch tagging** for multiple recordings
- **Filter by tag** in Recording Manager

### Playback & Preview
- **HLS video preview** with scrubbing
- **In/Out point marking** for clips
- **Chapter markers** (stored in local storage)
- **Keyboard shortcuts** for efficient navigation

### Export & Download
- **Single download** with temporary Mux URL
- **Bulk download** for multiple recordings
- **CSV export** of recording metadata
- **Final Cut Pro XML export** for editing workflows

### Management
- **Batch rename** recordings
- **Delete** single or multiple recordings
- **Notes** field for each recording
- **Refresh** to sync with Mux

---

## Embed Pages

### Stage-Specific Embeds
- **Individual embed pages** per stream/stage
- **Native HTML5 video controls** (play, pause, volume, fullscreen)
- **Break mode integration** - shows break video when producer activates
- **Responsive design** for any embed size

### Viewer Features
- **Autoplay with muted start** (browser-compliant)
- **Click to unmute** interaction
- **Fullscreen support**
- **Graceful offline state** display

---

## Technical Features

### Architecture
- **Static frontend** - HTML/CSS/JS (no framework)
- **Netlify Functions** for serverless API
- **Netlify Blobs** for configuration storage
- **Mux** for video infrastructure

### Browser Support
- **Chrome/Edge** - Full support
- **Safari** - Full support including VU meters
- **Firefox** - Full support
- **Mobile browsers** - Touch-optimized interface

### Security
- **Producer password** for Settings access
- **Session-based authentication**
- **API keys** stored in environment variables
- **Webhook signature verification**

---

## Event Info Display

- **Event name and date**
- **Call time, Live start, Live end**
- **Producer name and phone**
- **Crew brief/instructions**
- **WhatsApp group link**

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ESC | Return to grid view from single-stream view |
| Click stream name | Toggle single-stream view |
| Click speaker icon | Toggle audio for that stream |

---

## Configuration Storage

| Item | Storage Location |
|------|------------------|
| Dashboard config | Netlify Blobs (`config`) |
| Break mode state | Netlify Blobs (`break-mode`) |
| Encoder states | Netlify Blobs (`encoder-states`) |
| Recordings index | Netlify Blobs (`recordings-index`) |
| User preferences | Browser localStorage |

---

## Version History Highlights

| Version | Features |
|---------|----------|
| v2.5 | Audio toggle (speaker icon), dual break buttons |
| v2.4 | Webhook-based encoder detection, Safari fixes |
| v2.3 | Server-side VU meters via WebSocket |
| v2.2 | Break mode implementation |
| v2.1 | Recording Manager complete |
| v2.0 | Multi-stream support, settings overhaul |
| v1.0 | Initial crew dashboard |

---

## URLs

- **Production:** https://play.mediahouse.com.au
- **Repository:** GitHub (MediahouseTech/Play)
- **Mux Dashboard:** https://dashboard.mux.com

---

*PLAY is a Mediahouse Productions product, designed for professional livestream event monitoring.*
