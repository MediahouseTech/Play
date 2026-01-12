# PLAY - API Reference

All API endpoints are Netlify Functions, accessible via `/api/` prefix.

---

## /api/config

Dashboard configuration management.

### GET /api/config

Returns current dashboard configuration.

**Response:**
```json
{
  "eventName": "Yabun Festival 2025",
  "streamBaseUrl": "https://stream.mux.com/",
  "expiryDate": "2026-01-27T23:59:00",
  "producerPassword": "Live2Stream",
  "eventInfo": {
    "date": "Sunday 26 January 2025",
    "callTime": "7:00 AM",
    "liveStart": "10:00 AM",
    "liveEnd": "6:00 PM",
    "brief": "...",
    "whatsappLink": "https://...",
    "producerName": "Scott",
    "producerPhone": "0412 XXX XXX"
  },
  "streams": [
    {
      "name": "Main Stage",
      "playbackId": "SRaLbHORMpqkvcB7cF3ziu7D701QzTxrzUw2GOFTfRf00",
      "liveStreamId": "spDSZGOT2fRmqVkMpvaiPMjnBD1qW8800ghXCHoJojBc",
      "streamKey": "xxx",
      "rtmpUrl": "rtmp://global-live.mux.com:5222/app"
    }
  ],
  "visibility": {
    "vuMeters": true,
    "streamStatus": true,
    "duration": true,
    "bitrate": true,
    "viewers": false
  }
}
```

### POST /api/config

Saves dashboard configuration.

**Request Body:** Same structure as GET response.

**Response:**
```json
{
  "success": true,
  "message": "Config saved"
}
```

---

## /api/stream-status

Get live stream status from Mux API + cached encoder states.

### GET /api/stream-status?streamIndex=0

**Query Parameters:**
- `streamIndex` (required) - Index of stream in config (0-3)

**Response:**
```json
{
  "success": true,
  "status": "active",
  "streamIndex": 0,
  "liveStreamId": "spDSZGOT2fRmqVkMpvaiPMjnBD1qW8800ghXCHoJojBc",
  "encoderConnected": true,
  "source": "webhook-cache"
}
```

**Status Values:**
- `active` - Stream is live, encoder connected
- `idle` - No encoder connected
- `disconnected` - Encoder recently disconnected (webhook-based)

---

## /api/break-mode

Manage break mode state per stream.

### GET /api/break-mode

Returns current break mode state for all streams.

**Response:**
```json
{
  "success": true,
  "breakMode": {
    "0": false,
    "1": true,
    "2": false,
    "3": false,
    "fallbackPlaybackId": "optional-vod-id"
  }
}
```

### POST /api/break-mode

Toggle break mode for a stream.

**Request Body:**
```json
{
  "streamIndex": 1,
  "isOnBreak": true,
  "updatedBy": "producer"
}
```

**Response:**
```json
{
  "success": true,
  "breakMode": { "0": false, "1": true, "2": false, "3": false }
}
```

---

## /api/mux-webhook

Receives Mux webhook events for instant stream status updates.

### POST /api/mux-webhook

**Mux Events Handled:**
- `video.live_stream.connected` - Encoder connected
- `video.live_stream.disconnected` - Encoder disconnected
- `video.live_stream.idle` - Stream went idle

**Request Body (from Mux):**
```json
{
  "type": "video.live_stream.connected",
  "data": {
    "id": "spDSZGOT2fRmqVkMpvaiPMjnBD1qW8800ghXCHoJojBc"
  }
}
```

**Response:**
```json
{
  "received": true
}
```

**Side Effect:** Updates `encoder-states` in Netlify Blobs for instant status.

---

## /api/recordings

Manage recordings index and interact with Mux assets.

### GET /api/recordings

Returns cached recordings index.

**Response:**
```json
{
  "success": true,
  "count": 8,
  "recordings": [
    {
      "assetId": "abc123",
      "playbackId": "xyz789",
      "liveStreamId": "spDSZGOT...",
      "stageName": "Main Stage",
      "title": "Main Stage - 10/01/2026, 07:35 am",
      "createdAt": "1736466900",
      "createdFormatted": "10/01/2026, 07:35 am",
      "duration": 4140,
      "durationStr": "69 mins",
      "status": "ready",
      "tag": "keep",
      "notes": "Great performance"
    }
  ]
}
```

### GET /api/recordings?action=refresh

Re-fetches all assets from Mux API and rebuilds index.

### GET /api/recordings?action=download&assetId=abc123

Requests temporary download URL from Mux.

**Response:**
```json
{
  "success": true,
  "downloadUrl": "https://mux.com/...",
  "message": "Download URL ready (expires in 24 hours)"
}
```

### POST /api/recordings

Update or delete a recording.

**Update Request:**
```json
{
  "action": "update",
  "assetId": "abc123",
  "title": "New Title",
  "tag": "keep",
  "notes": "Some notes"
}
```

**Delete Request:**
```json
{
  "action": "delete",
  "assetId": "abc123"
}
```

---

## /api/debug-mux

Debug endpoint for Mux connection testing.

### GET /api/debug-mux

Returns Mux API connection status and live stream info.

---

## Netlify Blobs Keys

| Key | Purpose |
|-----|---------|
| `config` | Dashboard configuration |
| `break-mode` | Break mode state per stream |
| `encoder-states` | Cached encoder connection status (from webhooks) |
| `recordings-index` | Cached recordings with metadata |

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad request / invalid parameters
- `500` - Server error / Mux API error
