# PLAY - Feature Roadmap

## Current Version: v2.4 (Festival Ready)

---

## ✅ Completed Features

### Core Dashboard
- [x] Multi-stream monitoring (1-4 streams)
- [x] HLS.js video playback
- [x] Stream status indicators (Live/Offline/Idle)
- [x] Producer password protection
- [x] Event info display (date, times, contacts)
- [x] WhatsApp group link
- [x] SMS share functionality
- [x] Dashboard expiry date

### VU Meters (v2.3)
- [x] Server-side audio analysis (WebSocket)
- [x] Dual meters: LUFS + Peak
- [x] Broadcast-style visual design
- [x] Works across Safari and Brave
- [x] Graceful fallback when WebSocket unavailable

### Break Mode (v2.2)
- [x] Per-stream break mode toggle
- [x] Producer controls on main dashboard
- [x] Visual break state indicator
- [x] Optional fallback video support

### Encoder Status (v2.4)
- [x] Mux webhook integration
- [x] Instant disconnect detection
- [x] Cached encoder states in Netlify Blobs
- [x] Prevents VOD playback when encoder stops

### Recording Manager
- [x] Grid and list views
- [x] Search and filter
- [x] Stage-based filtering
- [x] Tag system (Keep/Review/Archive)
- [x] Batch rename
- [x] Batch tag
- [x] Download (single and bulk)
- [x] Delete (single and bulk)
- [x] CSV export
- [x] Final Cut XML export
- [x] Video preview with HLS playback
- [x] In/Out points for clips
- [x] Chapter markers (local storage)
- [x] Keyboard shortcuts

### Settings
- [x] Event info editing
- [x] Stream configuration
- [x] Playback ID / Stream Key / RTMP management
- [x] Display visibility toggles
- [x] Password change
- [x] Dashboard reset

---

## 🚧 In Progress / Planned

### v2.5 - Event Setup Wizard
- [ ] Create Mux livestream from Settings (no manual Mux login)
- [ ] Auto-populate Playback ID, Stream Key, Live Stream ID
- [ ] Recording Manager Tag creation during setup
- [ ] Tag color selection (per-stream/per-event)
- [ ] Variable stream count (1, 2, 3, or 4)

### v2.6 - Recording Manager Enhancements
- [ ] Event-specific tag filtering
- [ ] Tags defined in Settings appear in Recording Manager dropdown
- [ ] Auto-tag recordings based on Live Stream ID
- [ ] Improved date display (fix 1970 dates from Mux)

### v3.0 - Multi-Event Support
- [ ] Event archive/history
- [ ] Quick event duplication
- [ ] Event templates
- [ ] Per-event Mux API key support (client accounts)

---

## 💡 Future Ideas (Backlog)

### Dashboard
- [ ] Viewer count display (requires Mux Data)
- [ ] Bitrate monitoring
- [ ] Multi-language support
- [ ] Dark/light theme toggle
- [ ] Custom branding per event

### Recording Manager
- [ ] Mux clip creation (trim in cloud)
- [ ] Automatic thumbnail generation
- [ ] AI-powered highlight detection
- [ ] Frame-accurate clip export
- [ ] Direct upload to YouTube/Vimeo

### Infrastructure
- [ ] Multiple Mux accounts (per-client)
- [ ] Custom domain per event
- [ ] Analytics dashboard
- [ ] Usage reporting

### Mobile
- [ ] Responsive mobile view improvements
- [ ] Native iOS/Android app
- [ ] Push notifications for stream status

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| v2.4 | Jan 2026 | Webhook-based encoder detection, Safari fixes |
| v2.3 | Jan 2026 | Server-side VU meters via WebSocket |
| v2.2 | Jan 2026 | Break mode implementation |
| v2.1 | Jan 2026 | Recording Manager complete |
| v2.0 | Dec 2025 | Multi-stream support, settings overhaul |
| v1.0 | Oct 2025 | Initial crew dashboard (Minds Count) |

---

## Priority Matrix

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| HIGH | Mux livestream creation from Settings | Medium | High |
| HIGH | Event-specific recording tags | Low | High |
| MEDIUM | Variable stream count | Low | Medium |
| MEDIUM | Event templates | Medium | Medium |
| LOW | Mux clip creation | High | Medium |
| LOW | Multi-Mux accounts | High | Low |
