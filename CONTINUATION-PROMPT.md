# CONTINUATION PROMPT: Mediahouse Crew Dashboard v1.0 Bug Fixes

## CONTEXT FOR CLAUDE

You are continuing development of a **Crew Monitoring Dashboard** for Mediahouse, a video production company. The dashboard allows production crew to monitor multiple livestreams with VU meters on their mobile devices during live events.

**First deployment target:** Yabun Festival 2025 (4 simultaneous stages) - January 26, 2025

---

## PROJECT LOCATIONS

| Item | Location |
|------|----------|
| **Live Site** | https://yabun-crew-dashboard-26.netlify.app |
| **Netlify Admin** | https://app.netlify.com/projects/yabun-crew-dashboard-26 |
| **Netlify Site ID** | 2572fddb-3f95-41b4-96fb-f66b4c1ddcd1 |
| **GitHub Repo** | https://github.com/MediahouseTech/event-dashboard |
| **Local Files** | /Users/m4server/Documents/Yabun-Dashboard-26/ |
| **Wiki Docs** | /Users/m4server/Documents/Mediahouse-Wiki-Docs/ |

---

## FILE STRUCTURE

```
/Users/m4server/Documents/Yabun-Dashboard-26/
├── index.html              # Main dashboard HTML
├── config.json             # Default config (API overrides this)
├── package.json            # Dependencies (@netlify/blobs)
├── netlify.toml            # Build config
├── css/
│   └── dashboard.css       # All styles - dark theme
├── js/
│   ├── app.js              # Main application logic
│   ├── vu-meter.js         # VUMeter class - Web Audio API
│   ├── settings.js         # Settings modal, save to API
│   ├── visibility.js       # Page visibility handling
│   └── utils.js            # Copy, SMS, helpers
├── netlify/functions/
│   └── config.mjs          # GET/POST config via Netlify Blobs
└── images/
    └── poster.jpg          # Default poster (NEWLY ADDED)
```

---

## TECHNICAL IMPLEMENTATION SUMMARY

### Config Storage
- **Netlify Blobs** used for persistent storage across all browsers
- API endpoint: `/api/config` (GET to load, POST to save)
- Settings are editable in producer-protected modal (password: `Live2Stream`)

### Mux Player
- Using `<mux-player>` web component from CDN
- Attributes: `playback-id`, `stream-type="live"`, `muted`, `autoplay`, `playsinline`
- Access internal video element via `player.media` property (shadow DOM)

### VU Meters (NOT WORKING - NEEDS FIX)
- `VUMeter` class in `js/vu-meter.js`
- Uses Web Audio API: `AudioContext`, `AnalyserNode`, `createMediaElementSource`
- Stereo L/R channel display with peak hold
- Color zones: Green (-40 to -12dB), Yellow (-12 to -6dB), Red (-6 to 0dB)
- Canvas-based rendering
- **Current issue:** Meters show scale but no audio bars animate

### Page Visibility
- Pauses streams when phone screen locks (battery/data saving)
- Resumes at live edge when visible

---

## BUG FIXES REQUIRED

### BUG 1: Dashboard Playing On-Demand Instead of Live-Only (CRITICAL)

**Problem:** When the encoder (OBS) stops streaming, the dashboard starts playing an on-demand/recorded version of the stream while showing "LIVE" status. This is misleading and defeats the purpose of a monitoring dashboard.

**Expected Behavior:** 
- Dashboard should ONLY show live content
- When encoder stops, player should show poster/waiting state, NOT recorded playback
- Status must accurately reflect encoder → Mux server connection

**Research needed:** 
- Mux `stream-type="live"` vs `stream-type="ll-live"` behavior
- How to detect stream status (active vs idle) via Mux Data API or player events
- `mux-player` attributes to prevent VOD fallback

### BUG 2: VU Meters Not Working (CRITICAL)

**Problem:** VU meters display the dB scale but no audio bars animate, even when stream is playing with audio.

**Current Implementation:**
```javascript
// In vu-meter.js init()
const mediaElement = this.video.media || this.video;
this.source = this.audioContext.createMediaElementSource(mediaElement);
```

**Possible Issues:**
1. `player.media` may not be ready when init() is called
2. CORS restrictions on Mux CDN (though Mux should handle this)
3. AudioContext not properly resumed
4. MediaElementSource can only be created once per element
5. Need to wait for `loadedmetadata` or `canplay` event

**Acceptance Criteria:**
- VU meters must show real-time audio levels
- If 60fps is not achievable, 30fps or even 15fps is acceptable
- Must work on desktop Chrome/Safari and iOS Safari

### BUG 3: Video Player Aspect Ratio

**Problem:** Video player windows may not maintain 16:9 aspect ratio.

**Fix:** Ensure CSS enforces 16:9 using `aspect-ratio: 16/9` or padding-bottom trick.

### BUG 4: Frame Rate Settings Incorrect

**Problem:** High quality shows 30fps but Mediahouse only encodes at 25fps.

**Required Settings:**
- HIGH: 1080p @ 25fps (match encoder)
- MED: 720p @ 15fps  
- LOW: 480p @ 5fps

**Research:** Does Mux `max-resolution` or `preferredRendition` control frame rate, or only resolution? May need Mux Data API.

### BUG 5: Default Poster Image

**Problem:** No poster shown when stream is not active.

**Fix:** Add `poster="images/poster.jpg"` attribute to mux-player elements.

**File location:** `/Users/m4server/Documents/Yabun-Dashboard-26/images/poster.jpg` (already added)

### BUG 6: Accurate Stream Status Detection (CRITICAL)

**Problem:** Status indicator doesn't accurately reflect encoder-to-server connection state.

**Current States Needed:**
| Encoder State | Mux State | Dashboard Should Show |
|---------------|-----------|----------------------|
| OBS not running | Stream idle | ⏳ Waiting + poster |
| OBS streaming | Stream active | 🟢 LIVE |
| OBS stops | Stream goes idle | ⏳ Waiting + poster (NOT recorded playback!) |
| OBS buffering | Stream connecting | ⏳ Connecting |

**Research Needed:**
- Mux player events: `waiting`, `playing`, `pause`, `error`, `stalled`
- Mux Data API for real-time stream status
- Should there be a per-player refresh button?
- `mux-player` `stream-status` attribute or similar

**Goal:** This is a DIAGNOSTIC TOOL - crew must trust the status indicator.

---

## DEPLOYMENT PROCESS

```bash
cd ~/Documents/Yabun-Dashboard-26
git add -A
git commit -m "Description of changes"
git push origin main
```

Then use Netlify MCP tool to deploy (Claude has access).

---

## SCOTT'S PREFERENCES

- **Make edits directly** - NEVER ask Scott to copy/paste code
- **Explain the "why"** in plain English
- **State plan before code** - especially for complex debugging
- **No comments in bash commands** - Scott copy/pastes directly
- **Research first** - search for Mux documentation, GitHub issues, Stack Overflow
- **Test assumptions** - verify Mux player behavior before implementing

---

## PRIORITY ORDER

1. **BUG 1 & 6** - Live-only playback and accurate status (these are related)
2. **BUG 2** - VU meters (cornerstone feature)
3. **BUG 5** - Poster image (quick fix)
4. **BUG 3** - Aspect ratio (quick fix)
5. **BUG 4** - Frame rates (may require research)

---

## START

Begin by:
1. Reading the current `js/app.js` and `js/vu-meter.js` files
2. Researching Mux player live stream behavior and status detection
3. State your plan for fixing the bugs before writing code
