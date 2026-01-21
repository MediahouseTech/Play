# NEW CHAT PROMPT: Add Encoder Controls to Lab Dashboard

Copy everything below this line into a new Claude chat:

---

## PROJECT: Add Encoder Start/Stop Controls to Lab Dashboard

### CRITICAL CONTEXT - READ FIRST

I need to add **encoder start/stop controls** to my existing **Lab Dashboard** (BlueHaze-Dashboard). The encoders are FFmpeg processes that generate test RTMP streams to Mux. Currently I have NO WAY to stop them without SSH - this is dangerous during live events.

**I am Scott** - a video production professional with basic HTML/CSS knowledge. I cannot write code from scratch. I need exact, step-by-step instructions. Claude has filesystem access to edit my files directly.

### WHAT EXISTS NOW

**Lab Dashboard Location:** `/Users/m4server/Documents/BlueHaze-Dashboard/`
- `index.html` - Main dashboard with encoder status cards, settings modal
- `style-proxmenux.css` - Styling
- Deployed to: CT 114 webserver at `http://192.168.30.114/`

**Current Features:**
- 4 encoder status cards showing: Preview thumbnail, Stream name, Status (LIVE/OFFLINE), Duration
- Settings modal with encoder configuration (CAT profiles, Mux stream selection)
- Connects to Mux API to show stream status

**Encoder Infrastructure:**
- 4 FFmpeg encoder services run on **CT 114** (webserver container) in Proxmox
- Service names: `encoder01.service`, `encoder02.service`, `encoder03.service`, `encoder04.service`
- Location: `/etc/systemd/system/encoder0X.service`
- Each encoder reads config from: `/opt/encoders/encoder0X/config.env`
- FFmpeg command sends RTMP to Mux using stream key from config

**Sample encoder service file (`encoder01.service`):**
```
[Unit]
Description=FFmpeg Test Encoder 01
After=network.target

[Service]
Type=simple
EnvironmentFile=/opt/encoders/encoder01/config.env
ExecStart=/usr/bin/ffmpeg -re -stream_loop -1 -i ${INPUT_FILE} \
  -c:v libx264 -preset veryfast -b:v ${BITRATE} \
  -c:a aac -b:a 128k \
  -f flv rtmp://global-live.mux.com:5222/app/${STREAM_KEY}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Sample config.env:**
```
INPUT_FILE=/opt/encoders/media/test-pattern.mp4
BITRATE=2500k
STREAM_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Proxmox Access:**
- Host: `proxmox` (192.168.30.200)
- Container 114 commands via: `sudo pct exec 114 -- <command>`
- SSH MCP tools available for remote command execution

### WHAT I NEED BUILT

**1. Backend API Endpoint**
Create a simple Node.js/Express server (or PHP script) on CT 114 that:
- `GET /api/encoders` - Returns status of all 4 encoders (running/stopped)
- `POST /api/encoders/start` - Starts an encoder by number (1-4)
- `POST /api/encoders/stop` - Stops an encoder by number (1-4)
- `POST /api/encoders/restart` - Restarts an encoder by number (1-4)

Example response for GET:
```json
{
  "encoders": [
    {"id": 1, "status": "running", "uptime": "2h 34m"},
    {"id": 2, "status": "stopped", "uptime": null},
    {"id": 3, "status": "running", "uptime": "1h 12m"},
    {"id": 4, "status": "stopped", "uptime": null}
  ]
}
```

**2. Dashboard UI Controls**
Add to each encoder card:
- **START** button (green) - visible when encoder is stopped
- **STOP** button (red) - visible when encoder is running  
- **RESTART** button (orange) - always visible
- Confirmation dialog before STOP action ("Are you sure? This will end the stream.")
- Visual feedback during action (spinner/loading state)

**3. Security**
- API should only accept requests from localhost or Lab Dashboard origin
- No authentication needed (internal network only)

### FILE STRUCTURE TO CREATE

```
CT 114: /opt/encoder-api/
├── server.js          # Express API server
├── package.json       # Dependencies
└── encoder-api.service # Systemd service file

Dashboard: /Users/m4server/Documents/BlueHaze-Dashboard/
├── index.html         # Add control buttons to encoder cards
├── style-proxmenux.css # Add button styles
└── js/
    └── encoder-controls.js # API calls for start/stop/restart
```

### DESIGN REQUIREMENTS

**Button Styling (match existing dashboard theme):**
- Dark theme with cyan accents (#0ef)
- Buttons should be compact, fit in encoder card footer
- START: Green background (#00c853)
- STOP: Red background (#ff1744)  
- RESTART: Orange background (#ff9100)
- Loading state: Pulsing animation, disabled click

**Layout in encoder card:**
```
┌─────────────────────────────┐
│ [Preview Thumbnail]         │
│ Main Stage                  │
│ 🟢 LIVE | 02:34:15         │
├─────────────────────────────┤
│ [RESTART]        [STOP]     │
└─────────────────────────────┘
```

When stopped:
```
┌─────────────────────────────┐
│ [Preview Thumbnail]         │
│ Main Stage                  │
│ ⚫ OFFLINE                  │
├─────────────────────────────┤
│ [RESTART]        [START]    │
└─────────────────────────────┘
```

### STEP-BY-STEP IMPLEMENTATION ORDER

1. **First** - Create the API server on CT 114
2. **Second** - Test API with curl commands
3. **Third** - Add systemd service for API
4. **Fourth** - Update dashboard HTML with control buttons
5. **Fifth** - Add JavaScript for API calls
6. **Sixth** - Add CSS styling
7. **Finally** - Test end-to-end

### COMMANDS CLAUDE WILL NEED

**Check encoder status:**
```bash
sudo pct exec 114 -- systemctl is-active encoder01
sudo pct exec 114 -- systemctl status encoder01 --no-pager
```

**Start/Stop/Restart encoder:**
```bash
sudo pct exec 114 -- systemctl start encoder01
sudo pct exec 114 -- systemctl stop encoder01
sudo pct exec 114 -- systemctl restart encoder01
```

**Get uptime:**
```bash
sudo pct exec 114 -- systemctl show encoder01 --property=ActiveEnterTimestamp
```

### IMPORTANT NOTES

- Claude has SSH MCP access via `ssh-proxmox:runRemoteCommand`
- Claude has filesystem access to edit BlueHaze-Dashboard files directly
- CT 114 already has Node.js installed (used by audio-analyzer)
- The API server should run on a different port (e.g., 3002) to avoid conflicts
- Test with encoder01 first before implementing all 4

### SUCCESS CRITERIA

1. I can click STOP on any encoder card and the FFmpeg stream stops within 5 seconds
2. I can click START and the encoder begins streaming again
3. Dashboard shows real-time status (polling every 5 seconds)
4. Confirmation dialog prevents accidental stops
5. Works reliably without SSH access

---

**START BY:** Reading the current Lab Dashboard files to understand the existing structure, then create the API server.
