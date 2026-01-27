# PLAY Dashboard Updates - 23 January 2026

## Final Pre-Production Release (v2.5-yabun-ready)

This document summarizes improvements made to the PLAY Crew Dashboard in preparation for Yabun Festival 2026 (Monday 26 January).

---

## New Features

### 1. Connection Health Indicator
A new visual indicator showing encoder-to-Mux connection quality in real-time.

**Location:** Player header, next to speaker icon

**Status Colors:**
- 🟢 **Green (Excellent)** - Stream drift ≤ 500ms
- 🟡 **Yellow (Good)** - Stream drift 500ms - 1s  
- 🔴 **Red (Poor)** - Stream drift > 1s
- ⚪ **Gray (Unknown)** - No data or stream offline

**How It Works:**
- Polls Mux Stats API every 15 seconds while stream is live
- Measures "max_live_stream_latency" (drift between encoder and CDN)
- Tooltip shows actual drift value on hover

**Technical Implementation:**
- New API endpoint: `/api/stream-health`
- Uses Mux Data API with 1-minute timeframe
- Requires `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` environment variables

### 2. Footer Health Legend
Added a compact legend to the dashboard footer explaining the health indicator colors.

**Display:** Health: 🟢 Excellent 🟡 Good 🔴 Poor ⚪ Offline

### 3. Stream Audio Toggle
Click the speaker icon on any stream to hear its audio. Only one stream can have audio at a time - clicking another stream's speaker will switch audio to that stream.

**Visual Feedback:**
- Active audio: Orange glow around speaker icon
- All others: Muted (default state)

---

## UI/UX Improvements

### Status Text Clarification
- Changed "Not Live" → "No Stream" for clearer communication
- Applies to both the overlay message and status badge

### Break Mode Button Fixes (Mobile)
- Fixed sticky hover states on iOS/Android
- Compact button layout for smaller screens
- Proper blur on button press to clear focus states
- GO LIVE button now consistently green (#22c55e)

### SHOW Bar Visibility
- SHOW toggles (Health, Duration, Bitrate, Viewers) now hidden for non-producers
- Appears after producer login to reduce UI clutter for crew

---

## Technical Changes

### New Files
- `/netlify/functions/stream-health.mjs` - Mux Stats API integration

### Modified Files
- `/js/app.js` - Connection health polling, audio toggle, status text changes
- `/css/dashboard.css` - Health indicator styles, footer legend
- `/index.html` - Footer legend HTML, cache version bumps
- `/netlify.toml` - Stream-health API redirect

### Cache Versions Updated
- `dashboard.css` → v12.7
- `app.js` → v4.3

---

## Testing Checklist

Before going live, verify:

- [ ] Connection health indicator shows gray when stream offline
- [ ] Health indicator turns green/yellow/red when encoder streaming
- [ ] Footer legend displays correctly
- [ ] Audio toggle works - only one stream at a time
- [ ] "No Stream" displays instead of "Not Live"
- [ ] Break buttons work on mobile without stuck states
- [ ] GO LIVE button is green when on break
- [ ] SHOW bar hidden until producer login

---

## Git Reference

**Tag:** `v2.5-yabun-ready`

**Key Commits:**
- `1764110` - Change 'Not Live' to 'No Stream'
- `98900b5` - Add connection health legend to footer
- `867b5a3` - Add connection health indicator with Mux Stats API
- `146945e` - Add audio toggle feature

---

## Known Limitations

1. **Health Indicator Requires Mux Data** - Only works with active Mux account and valid API credentials
2. **15-Second Polling** - Health status updates every 15 seconds, not real-time
3. **1-Minute Sample Window** - Uses rolling 1-minute average from Mux Stats

---

## Next Steps (Post-Yabun)

1. Consider adding health history graph
2. Implement alerts for sustained poor connection
3. Add viewer count display (requires Mux Data subscription)
