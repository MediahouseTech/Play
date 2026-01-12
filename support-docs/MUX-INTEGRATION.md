# PLAY - Mux Integration Guide

## Overview

Play integrates with Mux for all video infrastructure:
- **Live streaming** - RTMP ingest, HLS delivery
- **Recordings** - Automatic VOD creation from live streams
- **Webhooks** - Real-time stream status updates

---

## Mux Account Details

| Item | Value |
|------|-------|
| Account | Mediahouse (Scott's account) |
| API Token ID | Stored in Netlify env: `MUX_TOKEN_ID` |
| API Token Secret | Stored in Netlify env: `MUX_TOKEN_SECRET` |
| Webhook Secret | Stored in Netlify env: `MUX_WEBHOOK_SECRET` |
| Dashboard | https://dashboard.mux.com |

---

## Live Stream Setup

### Creating a Live Stream (Currently Manual)

1. Log into Mux Dashboard
2. Video → Live Streams → Create Live Stream
3. Settings:
   - Latency: Low latency (recommended)
   - Recording: Enabled (creates VOD automatically)
   - Playback: Public (signed not required for Play)
4. Copy these values to Play Settings:
   - **Live Stream ID** - For status checking
   - **Playback ID** - For HLS video URL
   - **Stream Key** - For encoder configuration

### RTMP Ingest

Encoders send to:
```
Server: rtmp://global-live.mux.com:5222/app
Stream Key: [from Mux dashboard]
```

### HLS Playback URL Format

```
https://stream.mux.com/{PLAYBACK_ID}.m3u8
```

---

## Webhooks

Play uses Mux webhooks for instant encoder status detection.

### Webhook URL

```
https://play.mediahouse.com.au/api/mux-webhook
```

### Events Handled

| Event | Action |
|-------|--------|
| `video.live_stream.connected` | Mark encoder as connected |
| `video.live_stream.disconnected` | Mark encoder as disconnected |
| `video.live_stream.idle` | Mark stream as idle |

### Why Webhooks Matter

**Without webhooks:** Dashboard polls Mux API every 30 seconds. If encoder disconnects, it takes up to 60 seconds to detect (Mux has reconnect window).

**With webhooks:** Instant detection. The moment encoder disconnects, Mux sends webhook, Play updates status immediately.

### Webhook Flow

```
Encoder disconnects
       ↓
Mux sends POST to /api/mux-webhook
       ↓
mux-webhook.mjs updates Netlify Blob "encoder-states"
       ↓
Dashboard polls /api/stream-status
       ↓
stream-status.mjs returns cached state from "encoder-states"
       ↓
Dashboard shows "OFFLINE" immediately
```

---

## Recordings

### How Recordings Work

1. Live stream has "Recording" enabled in Mux
2. When stream ends, Mux creates an Asset (VOD)
3. Asset is linked to original Live Stream ID
4. Play's Recording Manager fetches all Assets from Mux API
5. Matches Assets to stages via Live Stream ID

### Mux API Calls for Recordings

**List all assets:**
```
GET https://api.mux.com/video/v1/assets?limit=100
```

**Get download URL:**
```
PUT https://api.mux.com/video/v1/assets/{ASSET_ID}/master-access
Body: { "master_access": "temporary" }

GET https://api.mux.com/video/v1/assets/{ASSET_ID}
Returns: { "master": { "url": "https://..." } }
```

**Delete asset:**
```
DELETE https://api.mux.com/video/v1/assets/{ASSET_ID}
```

**Update metadata:**
```
PATCH https://api.mux.com/video/v1/assets/{ASSET_ID}
Body: { "meta": { "title": "New Title", "external_id": "custom-id" } }
```

---

## Thumbnail Generation

Mux generates thumbnails on-the-fly via URL parameters:

```
https://image.mux.com/{PLAYBACK_ID}/thumbnail.jpg?time=10&width=640
```

Parameters:
- `time` - Seconds into video
- `width` - Image width (height auto-calculated)
- `height` - Image height
- `fit_mode` - crop, preserve, smartcrop

---

## Mux Pricing (for reference)

| Service | Cost |
|---------|------|
| Live streaming | $0.005 per minute delivered |
| Video storage | $0.0055 per minute stored per month |
| Video encoding | $0.015 per minute encoded |
| Data transfer | Included in delivery price |

---

## Troubleshooting

### Stream shows "Idle" but encoder is running
- Check Stream Key is correct
- Check RTMP URL is exactly `rtmp://global-live.mux.com:5222/app`
- Check firewall allows outbound port 5222

### Webhook not triggering
- Verify webhook URL in Mux dashboard
- Check Netlify function logs for errors
- Verify `MUX_WEBHOOK_SECRET` matches

### Recordings not appearing
- Ensure "Recording" is enabled on Live Stream
- Wait 2-3 minutes after stream ends
- Click "Refresh" in Recording Manager

### Download URL not working
- Master access takes a few seconds to enable
- URL expires after 24 hours
- Try refreshing the download request
