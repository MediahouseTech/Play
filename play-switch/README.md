# Play-Switch

WebRTC-based confidence monitoring system for remote ATEM switching operations.

## Overview

Play-Switch provides real-time Preview and Program feeds from an ATEM switcher via WebRTC, enabling remote switching operations from anywhere with internet access.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    STUDIO (192.168.x.x)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ATEM SDI Extreme ISO ──┬── Preview Out ── Web Presenter HD     │
│  (192.168.40.93)        │                  (192.168.40.51)       │
│                         │                         │              │
│                         └── Program Out ── Web Presenter 4K     │
│                                            (192.168.40.181)      │
│                                                   │              │
│                         ┌─────────────────────────┘              │
│                         ▼                                        │
│              ┌─────────────────────┐                            │
│              │   LXC 114 (MediaMTX)│                            │
│              │   192.168.30.13     │                            │
│              │                     │                            │
│              │  RTMP ← Web Pres    │                            │
│              │  WebRTC → Browsers  │                            │
│              └──────────┬──────────┘                            │
│                         │                                        │
└─────────────────────────┼────────────────────────────────────────┘
                          │
                   Cloudflare Tunnel
                          │
                          ▼
              switch.mediahouse.com.au
                          │
                          ▼
              ┌───────────────────────┐
              │   Remote Browser      │
              │   (Field MacBook)     │
              └───────────────────────┘
```

## Components

### LXC 114 - Play-Switch Container
- **nginx**: Serves static files + reverse proxy
- **MediaMTX**: RTMP ingest + WebRTC (WHEP) output
- **Location**: Proxmox "lab" node

### Stream Paths
| Path | Source | Purpose |
|------|--------|---------|
| `/preview` | WPHD RTMP | ATEM Preview output |
| `/program` | WP4K RTMP | ATEM Program output |
| `/program-audio` | RTSP (FFmpeg) | Program with Opus audio for WebRTC |

### External Services
- **Companion** (192.168.30.84:8000): ATEM stream/record status via custom variables
- **Web Presenter HD** (192.168.40.51): Preview encoder + API
- **Web Presenter 4K** (192.168.40.181): Program encoder + API

## Status Pane Features

| Section | Data Source | Info Displayed |
|---------|-------------|----------------|
| ENC | Web Presenter API | WPHD/WP4K streaming status, START/STOP controls |
| ATEM | Companion API | Stream and Record status |
| MTX | MediaMTX API | Path status, viewer count |
| PVW | WebRTC stats | Connection, latency, packet loss, FPS |
| PGM | WebRTC stats | Connection, latency, packet loss, FPS, audio |

## Files

| File | Location | Purpose |
|------|----------|---------|
| `index.html` | `/var/www/play-switch/` | Main dashboard |
| `nginx-play-switch.conf` | `/etc/nginx/sites-available/play-switch` | Nginx config |
| `mediamtx.yml` | `/opt/mediamtx/mediamtx.yml` | MediaMTX config |

## Known Issues

### Remote WebRTC Fails
**Problem**: Local clients see video, remote clients (through Cloudflare tunnel) don't.

**Cause**: Cloudflare tunnel only carries HTTP/HTTPS. WebRTC media uses UDP which can't traverse the tunnel.

**Solution**: Implement coturn TURN server for media relay (in progress).

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-30 | Initial release - local WebRTC working |
| 1.1 | TBD | TURN server for remote access |
