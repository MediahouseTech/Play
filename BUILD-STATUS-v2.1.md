# YABUN DASHBOARD BUILD STATUS - v2.1
## Backup Date: 9 January 2026
## Git Commit: c18c746

---

## ✅ WHAT'S WORKING

### 1. Live Stream Detection (Mux API)
- Netlify function `/api/stream-status` calls Mux API
- Returns `status: "active"` or `status: "idle"`
- Dashboard correctly shows "🟢 LIVE" when encoder is streaming

### 2. Video Playback
- HLS.js loads stream from direct Mux URL: `https://stream.mux.com/{playbackId}.m3u8`
- Video plays correctly when stream is live
- Proxy URL removed (was causing CORS 530 errors)

### 3. VOD/Recording Blocking
- HLS.js `LEVEL_LOADED` event checks `data.details.live`
- If `live === false`, playback is stopped immediately
- `confirmedNotLive` flag prevents retry loops during Mux reconnect window
- Flag clears when API returns `idle`, allowing fresh attempts

### 4. Stream Polling
- Polls Mux API every 10 seconds when stream is offline
- Automatically loads player when stream goes live
- Respects `confirmedNotLive` block to prevent VOD loops

### 5. UI Components
- 4-panel grid view
- Single-stream view selector
- Bandwidth controls (LOW/MED/HIGH)
- Settings panel with producer password protection
- Event info tab

---

## ❌ WHAT'S NOT WORKING

### 1. Live Status Update When Encoder Stops
**Problem:** When OBS/LiveU stops encoding, video freezes but status stays "🟢 LIVE"

**Root Cause:** 
- Mux API keeps returning `status: "active"` for 60 seconds (reconnect window)
- No client-side detection that video has stalled
- `liveStatusPoller` checks API but API lies during reconnect window

**Attempted Fix:** Added `startLiveStatusPoller()` but it relies on API which is unreliable

**Proposed Fix:** Time-stall detection - if `video.currentTime` doesn't advance for 7-8 seconds, mark as not live

### 2. VU Meters
**Problem:** VU meters display but don't respond to actual audio levels

**Root Cause:** 
- Web Audio API requires CORS headers to access audio data
- Mux HLS streams don't provide necessary CORS headers
- `createMediaElementSource()` fails silently or returns empty data

**Status:** Parked - not fixable with current Mux setup without proxy

---

## 📁 KEY FILES

| File | Purpose |
|------|---------|
| `/js/app.js` | Main application logic, player management |
| `/js/vu-meter.js` | VU meter class (non-functional) |
| `/js/settings.js` | Settings panel, password protection |
| `/netlify/functions/stream-status.mjs` | Mux API status check |
| `/config.json` | Local fallback config (Netlify Blobs is primary) |

---

## 🔑 CREDENTIALS IN USE

- **Mux Token ID:** 7952c3b8-1fba-4bf8-b95a-219aee11cfe6
- **Mux Token Secret:** In stream-status.mjs (should move to env vars)
- **Live Stream ID:** spDSZGOT2fRmqVkMpvaiPMjnBD1qW8800ghXCHoJojBc
- **Playback ID:** SRaLbHORMpqkvcB7cF3ziu7D701QzTxrzUw2GOFTfRf00

---

## 🚀 NEXT STEPS (PLANNED)

### Break Mode Feature
1. Manual "GO TO BREAK" / "GO LIVE" buttons
2. Fallback VOD video plays when in break mode
3. Auto-detection: stream stall → break mode
4. Auto-resume: encoder reconnects → live mode
5. Server-side state (Netlify Blobs) so ALL viewers see same thing

### Pre-requisites
- [ ] Fallback video uploaded to Mux
- [ ] Critical architecture review (in progress)
- [ ] Confirm public page can be modified

---

## 🏷️ GIT TAG

This build is tagged as `v2.1-pre-breakmode`
