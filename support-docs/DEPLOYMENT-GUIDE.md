# PLAY - Deployment Guide

## Environments

| Environment | URL | Branch | Purpose |
|-------------|-----|--------|---------|
| Production | play.mediahouse.com.au | main | Live events |
| Staging | play-test.netlify.app | staging | Testing & development |

---

## Local Development

### Prerequisites
- Node.js 18+
- Git
- Netlify CLI (`npm install -g netlify-cli`)

### Setup
```bash
cd /Users/m4server/Documents/play
npm install
netlify dev
```

This starts a local server at `http://localhost:8888` with serverless functions working.

### Environment Variables for Local Dev

Create `.env` file (DO NOT COMMIT):
```
MUX_TOKEN_ID=your-token-id
MUX_TOKEN_SECRET=your-token-secret
MUX_WEBHOOK_SECRET=your-webhook-secret
```

---

## Netlify Configuration

### Site Settings

**Production Site:**
- Site name: `play-mediahouse`
- Custom domain: `play.mediahouse.com.au`
- Branch: `main`

**Staging Site (to be created):**
- Site name: `play-test`
- URL: `play-test.netlify.app`
- Branch: `staging`

### Environment Variables

Set in Netlify UI → Site Settings → Environment Variables:

| Variable | Description |
|----------|-------------|
| `MUX_TOKEN_ID` | Mux API Token ID |
| `MUX_TOKEN_SECRET` | Mux API Token Secret |
| `MUX_WEBHOOK_SECRET` | Mux webhook signing secret |

⚠️ **IMPORTANT:** After changing environment variables, you must trigger a new deploy. Serverless functions don't pick up env var changes until redeployed.

### Build Settings

From `netlify.toml`:
```toml
[build]
  publish = "."
  functions = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

---

## Git Workflow

### Branch Strategy
```
main        ← Production (play.mediahouse.com.au)
  └── staging   ← Testing (play-test.netlify.app)
        └── feature/xyz   ← Development branches
```

### Standard Workflow

1. **Pull latest changes:**
   ```bash
   cd /Users/m4server/Documents/play
   git pull origin main
   ```

2. **Create feature branch (for big changes):**
   ```bash
   git checkout -b feature/mux-livestream-creation
   ```

3. **Make changes and test locally:**
   ```bash
   netlify dev
   ```

4. **Commit changes:**
   ```bash
   git add .
   git commit -m "Add Mux livestream creation to Settings"
   ```

5. **Push to staging for testing:**
   ```bash
   git checkout staging
   git merge feature/mux-livestream-creation
   git push origin staging
   ```

6. **Test on staging site**

7. **Merge to production:**
   ```bash
   git checkout main
   git merge staging
   git push origin main
   ```

### Quick Fix Workflow (small changes)

```bash
git add .
git commit -m "Fix Safari CSS rendering issue"
git push origin main
```

---

## Deployment Process

### Automatic Deploys

Netlify automatically deploys when you push to the connected branch:
- Push to `main` → Deploys to production
- Push to `staging` → Deploys to staging (when configured)

### Manual Deploy

Via Netlify CLI:
```bash
netlify deploy --prod
```

### Deploy Previews

Every pull request gets a preview URL automatically.

---

## Netlify Blobs

Play uses Netlify Blobs for persistent storage. Each site has its own blob store.

### Blob Store Name
```
yabun-dashboard
```

### Blob Keys
| Key | Content |
|-----|---------|
| `config` | Dashboard configuration JSON |
| `break-mode` | Break mode state per stream |
| `encoder-states` | Cached encoder connection status |
| `recordings-index` | Cached recordings with metadata |

### Viewing Blobs

Via Netlify CLI:
```bash
netlify blobs:list --store yabun-dashboard
netlify blobs:get --store yabun-dashboard config
```

### Resetting Blobs (Danger!)

To clear all data (use Reset Dashboard instead):
```bash
netlify blobs:delete --store yabun-dashboard config
netlify blobs:delete --store yabun-dashboard break-mode
netlify blobs:delete --store yabun-dashboard encoder-states
netlify blobs:delete --store yabun-dashboard recordings-index
```

---

## Mux Webhook Setup

1. Go to Mux Dashboard → Settings → Webhooks
2. Add webhook:
   - URL: `https://play.mediahouse.com.au/api/mux-webhook`
   - Events: Select `video.live_stream.*`
3. Copy signing secret to Netlify env `MUX_WEBHOOK_SECRET`
4. Redeploy site

---

## Troubleshooting Deployments

### Functions not working after env var change
**Solution:** Trigger a new deploy (even if no code changed):
```bash
git commit --allow-empty -m "Trigger redeploy for env vars"
git push origin main
```

### Blobs returning old data
**Solution:** Blobs may be cached. Clear browser cache or wait a few minutes.

### Deploy failing
**Check:**
1. Netlify build logs
2. `netlify.toml` syntax
3. Node version compatibility

### Function timeout
**Cause:** Netlify functions timeout at 10 seconds (26 seconds on paid plans).
**Solution:** Optimize API calls, add caching.

---

## Rollback

If a deploy breaks production:

1. Go to Netlify UI → Deploys
2. Find the last working deploy
3. Click "Publish deploy"

Or via Git:
```bash
git revert HEAD
git push origin main
```

---

## Monitoring

### Netlify Analytics
- Netlify UI → Analytics
- Page views, bandwidth, function invocations

### Function Logs
- Netlify UI → Functions → Select function → View logs
- Real-time logs for debugging

### Mux Dashboard
- Stream status
- Encoding minutes
- Storage usage
