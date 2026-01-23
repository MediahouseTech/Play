# PLAY Dashboard - Feature Updates (January 2026)

This document contains new features to be merged into the existing PLAY wiki documentation.

---

## Multi-Break Video System

PLAY now supports **two break video options per stream**, allowing producers to switch between different break content during an event.

### How It Works

Each stream has three control buttons:

| Button | Color | Action |
|--------|-------|--------|
| **Break 1** | Red (default) | Switch to Break Video 1 |
| **Break 2** | Red (default) | Switch to Break Video 2 |
| **GO LIVE** | Green | Return to live stream |

When a stream is live, both Break buttons are visible. When on break, only the GO LIVE button appears.

### Break Button States

```
LIVE MODE:
┌──────────────────────────────────┐
│  Stream 1: Main Stage            │
│  [VIDEO PLAYER - LIVE FEED]      │
│  🟢 LIVE    [Break 1] [Break 2]  │
└──────────────────────────────────┘

BREAK MODE:
┌──────────────────────────────────┐
│  Stream 1: Main Stage            │
│  [VIDEO PLAYER - BREAK VIDEO]    │
│  🔴 BREAK         [GO LIVE]      │
└──────────────────────────────────┘
```

### Assigning Break Videos to Streams

1. Open **Settings** (cog icon)
2. Expand a stream section
3. Use the **Break Video 1** dropdown to select from the Break Video Library
4. Use the **Break Video 2** dropdown to select a different video (optional)
5. Click **Save Settings**

If no break video is assigned, the stream will show the poster/slate image during breaks.

---

## Break Video Library

The Break Video Library stores up to **8 break videos** that can be assigned to any stream.

### Adding Break Videos

1. Open **Settings**
2. Scroll to **Break Video Library** section
3. Enter a Mux Playback ID for each slot (Break Video 1 through Break Video 8)
4. Click **Save Settings**

### Where to Get Playback IDs

Break videos are VOD assets in your Mux account. To get the Playback ID:

1. Go to Mux Dashboard → Video → Assets
2. Find your break video asset
3. Copy the **Playback ID** (not the Asset ID)

### Typical Break Video Setup

| Slot | Suggested Use |
|------|---------------|
| Break Video 1 | Generic "We'll be right back" slate |
| Break Video 2 | Sponsor loop |
| Break Video 3 | Event promo |
| Break Video 4 | Technical difficulties message |
| Break Video 5-8 | Stage-specific or backup content |

---

## Transition Settings

Control how smoothly the video transitions between live and break modes.

### Crossfade Duration

Located in **Settings → Transition Settings**, this controls the fade duration when switching between live stream and break video.

| Setting | Effect |
|---------|--------|
| **1.5 seconds** | Quick transition (recommended for most events) |
| **2-3 seconds** | Smoother, more cinematic transition |
| **Crossfade checkbox** | Enable/disable fade effect entirely |

When crossfade is disabled, the switch is instantaneous (hard cut).

---

## Monitor Scaling

The Scale bar at the bottom of the dashboard allows you to resize all video monitors for different display setups.

### Available Scales

| Scale | Best For |
|-------|----------|
| **75%** | Small screens, laptops, seeing all 4 streams at once |
| **100%** | Standard desktop viewing |
| **110%** | Slightly larger for better visibility |
| **125%** | Large monitors, control room displays |
| **150%** | Presentation mode, big screens |
| **175%** | Maximum size, single monitor focus |

The scale setting persists in your browser session.

---

## Recording Manager Tags

Recordings can now be tagged with **color-coded labels** for easy organization and filtering.

### Creating Tags

1. Open **Settings**
2. Scroll to **Recording Tags** section
3. Enter tag names (e.g., "Main Stage", "Interviews")
4. Select a color for each tag
5. Click **Save Settings**

### Default Tag Colors (Yabun Festival Example)

| Tag | Color |
|-----|-------|
| Main Stage | Purple |
| Yabun Yarns | Yellow |
| Corroboree | Red |
| SpeakOut | Cyan |

### Auto-Tagging

When enabled, recordings are automatically tagged based on which livestream they came from. The system matches the Live Stream ID to your configured streams.

### Using Tags in Recording Manager

- **Filter by tag:** Click a tag name to show only those recordings
- **Add tags manually:** Select recording → Choose tag from dropdown
- **Batch tag:** Select multiple recordings → Apply tag to all

---

## Slate & Poster Image Sync

PLAY can sync slate images directly to Mux livestreams, ensuring consistent branding across the platform.

### Image Types

| Image | Purpose | Filename Convention |
|-------|---------|---------------------|
| **Poster** | Shown before stream starts | `poster-1.jpg`, `poster-2.jpg`, etc. |
| **Slate** | Shown during breaks (fallback) | `slate-1.jpg`, `slate-2.jpg`, etc. |

### Syncing Images

1. Upload images to your designated storage
2. Open **Settings → Slate Images**
3. Click **Sync to Mux** button
4. Images are pushed to all configured Mux livestreams

The sync uses consistent file naming so the same poster/slate applies to Stream 1, 2, 3, and 4 respectively.

---

## Display Options

Fine-tune what information appears on each stream monitor.

| Option | What It Shows |
|--------|---------------|
| **Show VU Meters** | Real-time audio level bars |
| **Show Duration** | How long the stream has been live |
| **Show Bitrate** | Current encoding bitrate |
| **Show Viewers** | Viewer count (requires Mux Data) |

These options are producer-only and appear after logging in with the producer password.

---

# More Technical Reference

This section contains implementation details for Claude AI troubleshooting.

---

## Multi-Break API

### Endpoint: `/api/break-mode`

**GET Response:**
```json
{
  "success": true,
  "breakMode": {
    "0": 0,
    "1": 1,
    "2": 2,
    "3": 0
  },
  "breakVideos": {
    "library": [
      "playbackId1",
      "playbackId2",
      "playbackId3"
    ],
    "assignments": {
      "0": { "break1": 0, "break2": 1 },
      "1": { "break1": 0, "break2": 2 },
      "2": { "break1": 1, "break2": null },
      "3": { "break1": 0, "break2": null }
    }
  }
}
```

**Break Mode Values:**
- `0` = Live (not on break)
- `1` = On Break using Break Video 1
- `2` = On Break using Break Video 2

**POST Request:**
```json
{
  "streamIndex": 1,
  "breakSlot": 2,
  "updatedBy": "producer"
}
```

---

## Key JavaScript Functions

### app.js - Break Mode Functions

```javascript
// Toggle break mode from inline button
// slot: 0 = go live, 1 = break 1, 2 = break 2
async function toggleBreakModeInline(index, slot) { ... }

// Update inline break badge and button visibility
function updateInlineBreakBadge(index, breakSlot) { ... }

// Get break video playback ID for a stream and slot
function getBreakVideoForStream(streamIndex, slot) { ... }
```

### Button Color States (CSS)

```css
/* Break buttons - RED by default */
.break-control .btn-break-1,
.break-control .btn-break-2 {
    background: var(--error);  /* #ef4444 */
    color: white;
}

/* GO LIVE button - GREEN always (inline styles for iOS compatibility) */
.btn-go-live {
    background: #22c55e;
    color: #000;
    font-weight: 700;
}

/* Active state - ORANGE when on that break */
.break-control .btn-break-1.active,
.break-control .btn-break-2.active {
    background: var(--warning);  /* Orange */
}
```

### Mobile Touch Handling

iOS Safari has sticky hover states. The CSS includes touch device handling:

```css
@media (hover: none) and (pointer: coarse) {
    .break-control .btn-break-1:hover,
    .break-control .btn-break-2:hover {
        background: var(--error);  /* Stay red, don't show hover */
    }
    .break-control .btn-break-1:active {
        background: #dc2626;  /* Darker red only while pressing */
    }
}
```

JavaScript calls `blur()` after button clicks to clear stuck focus states.

---

## Netlify Blobs Schema Updates

### `break-mode` Blob

```json
{
  "0": 0,
  "1": 1,
  "2": 0,
  "3": 2,
  "library": [
    "abc123playbackid",
    "def456playbackid",
    "ghi789playbackid",
    null,
    null,
    null,
    null,
    null
  ],
  "assignments": {
    "0": { "break1": 0, "break2": 1 },
    "1": { "break1": 0, "break2": null },
    "2": { "break1": 2, "break2": null },
    "3": { "break1": 0, "break2": 1 }
  }
}
```

### `dashboard-config` Blob (Recording Tags)

```json
{
  "eventName": "Yabun Festival 26",
  "streams": [...],
  "recordingTags": [
    { "name": "Main Stage", "color": "#a855f7" },
    { "name": "Yabun Yarns", "color": "#eab308" },
    { "name": "Corroboree", "color": "#ef4444" },
    { "name": "SpeakOut", "color": "#06b6d4" }
  ],
  "transitionSettings": {
    "crossfade": true,
    "duration": 1.5
  }
}
```

---

## Embed Page Break Logic

Each embed page (e.g., `/embed/main-stage.html`) polls `/api/break-mode` and handles transitions:

```javascript
async function checkBreakMode() {
    const response = await fetch('/api/break-mode');
    const data = await response.json();
    
    const breakSlot = data.breakMode[streamIndex];
    
    if (breakSlot > 0) {
        // On break - get assigned video for this slot
        const assignment = data.breakVideos.assignments[streamIndex];
        const libraryIndex = breakSlot === 1 ? assignment.break1 : assignment.break2;
        const breakPlaybackId = data.breakVideos.library[libraryIndex];
        
        if (breakPlaybackId) {
            transitionTo('break', breakPlaybackId);
        } else {
            transitionTo('poster');
        }
    } else {
        transitionTo('live');
    }
}
```

---

## Common Issues

### Break Video Not Playing on Embed

**Symptom:** Clicking Break 1/2 on dashboard, but embed shows poster instead of video

**Cause:** No break video assigned for that stream/slot in Settings

**Solution:** 
1. Settings → Expand stream
2. Select a video from Break Video 1 dropdown
3. Save Settings

### GO LIVE Button Not Green on iOS

**Symptom:** GO LIVE button appears gray or wrong color on iPhone

**Cause:** CSS specificity conflicts or browser cache

**Solution:** 
- Button uses inline styles to force green: `style="background: #22c55e;"`
- Hard refresh (pull down and hold) or clear Safari cache
- Button also calls `blur()` to clear stuck hover states

### Scale Setting Not Persisting

**Symptom:** Scale resets to 100% on page reload

**Cause:** Normal behavior - scale is session-based, not saved to server

**Note:** This is intentional. Different crew members may prefer different scales on different devices.

---

## Version Reference

| Feature | Added In | Commit |
|---------|----------|--------|
| Multi-break (Break 1/2) | v2.5 | Various Jan 2026 |
| Break Video Library | v2.5 | Jan 2026 |
| Scale 110% option | v2.5 | Jan 2026 |
| Recording Tags | v2.5 | Jan 2026 |
| Transition Settings | v2.5 | Jan 2026 |
| iOS button fixes | v2.5 | bbf44bc |

---

*Last updated: January 2026*
