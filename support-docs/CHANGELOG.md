# PLAY - Changelog

All notable changes to Play are documented in this file.

---

## [v2.4] - 2026-01-12 - Festival Ready

### Added
- Mux webhook integration for instant encoder status
- Webhook handler (`mux-webhook.mjs`) for live_stream events
- Encoder states cached in Netlify Blobs
- Safari-specific CSS fixes with webkit prefixes

### Fixed
- Dashboard no longer plays VOD when encoder disconnects
- Stream status updates instantly (was 60 second delay)
- Safari VU meter rendering issues

### Technical
- `encoder-states` blob key stores webhook-based status
- `stream-status.mjs` checks webhook cache before Mux API
- Improved error handling in status polling

---

## [v2.3] - 2026-01-10 - Server-Side VU Meters

### Added
- WebSocket-based VU meters via audio-ws.mediahouse.com.au
- Dual meter display: LUFS (loudness) + Peak (true peak)
- Broadcast-style meter visualization
- Graceful fallback when WebSocket unavailable

### Technical
- `vu-meter.js` handles WebSocket connection
- Server runs FFmpeg for HLS audio analysis
- Bypasses CORS restrictions of Web Audio API

---

## [v2.2] - 2026-01-08 - Break Mode

### Added
- Per-stream break mode toggle
- Producer controls on main dashboard (after login)
- Break mode panel with visual status indicators
- Optional fallback video during breaks

### Technical
- `break-mode.mjs` function for state management
- Break state stored in Netlify Blobs
- Real-time sync across all viewers

---

## [v2.1] - 2026-01-05 - Recording Manager

### Added
- Full Recording Manager (`recordings.html`)
- Grid and list view options
- Search, filter by stage, filter by duration
- Tag system: Keep, Review, Archive
- Batch rename with pattern templates
- Batch tag functionality
- Single and bulk download
- Single and bulk delete
- CSV export
- Final Cut Pro XML export
- Video preview modal with HLS playback
- In/Out point markers
- Chapter markers (stored locally)
- Keyboard shortcuts (?, R, G, L, A, D, Delete)

### Technical
- `recordings.mjs` function for Mux asset management
- Recordings index cached in Netlify Blobs
- Master access for download URLs

---

## [v2.0] - 2025-12-20 - Multi-Stream Support

### Added
- Support for 1-4 simultaneous streams
- Stream configuration in Settings
- Per-stream Playback ID, Stream Key, Live Stream ID
- Stream status indicators per card
- Producer password protection
- Settings modal for all configuration
- Dashboard expiry date feature
- Reset Dashboard functionality

### Changed
- Migrated from single-stream to multi-stream architecture
- Config stored in Netlify Blobs instead of static file

---

## [v1.0] - 2025-10-30 - Initial Release (Minds Count)

### Added
- Single stream crew dashboard
- HLS.js video playback
- Event info display
- Basic status indicator
- WhatsApp link
- SMS share
- Producer name/phone display

### Technical
- Static HTML/CSS/JS
- Netlify hosting
- Mux video streaming

---

## Migration Notes

### v1.x to v2.x
- Config moved from `config.json` to Netlify Blobs
- Single stream config restructured to array of streams
- New Settings modal replaced inline editing

### v2.3 to v2.4
- Requires Mux webhook configuration
- Add `MUX_WEBHOOK_SECRET` environment variable
- Webhook URL: `https://play.mediahouse.com.au/api/mux-webhook`
