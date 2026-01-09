# TASK: Implement Audio Activity VU Meters for Mediahouse Crew Dashboard

## PROJECT CONTEXT

- **Repository:** `/Users/m4server/Documents/play/`
- **GitHub:** `MediahouseTech/Play.git`
- **Live URL:** https://play-mediahouse.netlify.app
- **Netlify Site ID:** `a350d47b-6a76-4ed8-b9f0-803d50619c8c`
- This is a crew monitoring dashboard for live streaming events
- Currently has VU meter UI (canvas elements) but they don't respond to audio

## CURRENT STATE

- `js/vu-meter.js` exists with full VU meter class using Web Audio API
- Web Audio API doesn't work with HLS.js streams (CORS/MediaSource limitations)
- VU meter canvases render but show no activity
- The `crossorigin="anonymous"` attribute on video elements breaks Mux playback - DO NOT ADD IT

## THE SOLUTION: webkitAudioDecodedByteCount

Replace the Web Audio API approach with byte-rate monitoring:

1. Poll `video.webkitAudioDecodedByteCount` every 100ms
2. Calculate bytes/second rate of change
3. Map rate to 0-100% visual level (experiment with scaling)
4. Apply smoothing for natural movement
5. Render to existing canvas with same visual style

## TECHNICAL APPROACH

```javascript
// Pseudocode concept
let lastBytes = 0;
let lastTime = performance.now();
let smoothedLevel = 0;

function pollAudio() {
    const video = document.getElementById('video-0');
    const currentBytes = video.webkitAudioDecodedByteCount || 0;
    const currentTime = performance.now();
    
    const bytesDelta = currentBytes - lastBytes;
    const timeDelta = (currentTime - lastTime) / 1000; // seconds
    const bytesPerSecond = bytesDelta / timeDelta;
    
    // Map to visual level (experiment with these values)
    // Typical audio might be 20000-200000 bytes/sec
    const level = Math.min(1, bytesPerSecond / 150000);
    
    // Apply smoothing
    smoothedLevel = smoothedLevel * 0.7 + level * 0.3;
    
    // Render to canvas
    renderMeter(smoothedLevel);
    
    lastBytes = currentBytes;
    lastTime = currentTime;
}

setInterval(pollAudio, 100);
```

## REQUIREMENTS

1. Modify `js/vu-meter.js` to use byte-rate instead of Web Audio API
2. Keep the existing visual style (L/R bars, color zones, peak hold)
3. Add fallback for Firefox (show "Audio: Unknown" or static indicator)
4. Initialize automatically when video starts playing
5. Handle the case where `webkitAudioDecodedByteCount` is undefined

## FILES TO MODIFY

- `js/vu-meter.js` - Replace Web Audio with byte-rate approach
- `js/app.js` - May need to adjust VU meter initialization

## VISUAL BEHAVIOR

| Audio State | Visual Response |
|-------------|-----------------|
| Silence | Bars at bottom, maybe subtle idle animation |
| Quiet audio | Bars in green zone, gentle movement |
| Normal audio | Bars bouncing green-yellow, active movement |
| Loud audio | Bars hitting yellow-red, energetic movement |
| Peak hold | Brief flash at highest point |

## CRITICAL: DO NOT

- Remove the existing canvas/visual infrastructure
- Try to make Web Audio API work (it won't with HLS)
- Add `crossorigin="anonymous"` to video elements (breaks Mux playback)
- Use `createMediaElementSource()` (taints video, breaks playback)
- Unmute the video element for analysis (not needed for byte counting)

## ALSO FIX FIRST

Before starting VU meters, remove the "Break Mode Controls" section from the Settings modal in `index.html`. It's redundant - break controls should only appear on the dashboard footer, not in settings.

Look for this section in the Settings modal and DELETE it:
```html
<div class="settings-section break-mode-section">
    <!-- Break Mode Controls Section - DELETE ALL OF THIS -->
</div>
```

Also remove any related JavaScript in `js/settings.js`:
- `populateBreakModeControls()` function
- Any calls to `populateBreakModeControls()`

## TEST WITH

1. OBS streaming to Mux live stream
2. Dashboard at https://play-mediahouse.netlify.app
3. Check browser console for byte rate values to calibrate scaling
4. Test in Chrome and Safari (webkit browsers)
5. Verify Firefox shows graceful fallback

## BROWSER SUPPORT

| Browser | webkitAudioDecodedByteCount | Fallback |
|---------|----------------------------|----------|
| Chrome | ✅ Yes | - |
| Safari | ✅ Yes | - |
| Firefox | ❌ No | Show "N/A" or static indicator |
| Edge | ✅ Yes (Chromium) | - |

## SUCCESS CRITERIA

- VU meters visually respond to audio activity in the stream
- Loud audio = high bars, silence = low bars
- Smooth, natural-looking animation
- No impact on video playback
- Works in Chrome/Safari, graceful fallback in Firefox
- Break Mode Controls removed from Settings modal

## GIT WORKFLOW

After changes:
```bash
cd /Users/m4server/Documents/play
git add -A
git commit -m "FEATURE: Audio activity VU meters using webkitAudioDecodedByteCount"
git push origin main
```

Then deploy via Netlify MCP or wait for auto-deploy.
