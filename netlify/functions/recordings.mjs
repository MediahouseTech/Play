/**
 * RECORDINGS.MJS - Recording Manager API
 * 
 * GET /api/recordings - Returns list of all recordings with metadata
 * GET /api/recordings?action=refresh - Re-fetch from Mux, auto-tag by stream
 * GET /api/recordings?action=download&assetId=X - Get download URL
 * POST /api/recordings - Update or delete recordings
 * 
 * KEY FEATURES:
 * - Dynamic stream detection via Mux passthrough field
 * - Auto-tagging based on stream config
 * - Preserves user edits (manual titles, notes, tags)
 */

import { getStore } from "@netlify/blobs";

// Mux API credentials
const MUX_TOKEN_ID = '7952c3b8-1fba-4bf8-b95a-219aee11cfe6';
const MUX_TOKEN_SECRET = 'kIT/Bs5wfBOIkVjljFAFT/EjqxVFKJ+kmKKyFXXRuRIO3HyyES5OZUBpXwfmezViqwnLCPGN0E8';

export default async function handler(request, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
    };

    // Handle CORS
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
    }

    try {
        const store = getStore("yabun-dashboard");
        const url = new URL(request.url);
        const action = url.searchParams.get('action');

        // GET - List all recordings
        if (request.method === 'GET' && !action) {
            let recordings = await store.get("recordings-index", { type: "json" }) || [];
            
            // Sort by created date, newest first
            recordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            return new Response(JSON.stringify({
                success: true,
                count: recordings.length,
                recordings: recordings
            }), { status: 200, headers });
        }

        // GET with action=download - Get download URLs for an asset
        if (request.method === 'GET' && action === 'download') {
            const assetId = url.searchParams.get('assetId');
            
            if (!assetId) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Missing assetId parameter'
                }), { status: 400, headers });
            }

            // First, enable master access if not already enabled
            // This is needed to get the downloadable MP4
            const auth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');
            const enableMasterResponse = await fetch(
                `https://api.mux.com/video/v1/assets/${assetId}/master-access`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${auth}`
                    },
                    body: JSON.stringify({ master_access: 'temporary' })
                }
            );

            // Get the asset details with master URL
            const assetResponse = await fetch(
                `https://api.mux.com/video/v1/assets/${assetId}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${auth}`
                    }
                }
            );

            if (!assetResponse.ok) {
                throw new Error(`Mux API error: ${assetResponse.status}`);
            }

            const assetData = await assetResponse.json();
            const asset = assetData.data;

            return new Response(JSON.stringify({
                success: true,
                assetId: asset.id,
                title: asset.meta?.title || 'Untitled',
                externalId: asset.meta?.external_id || null,
                duration: asset.duration,
                masterAccess: asset.master_access,
                downloadUrl: asset.master?.url || null,
                playbackUrl: asset.playback_ids?.[0]?.id 
                    ? `https://stream.mux.com/${asset.playback_ids[0].id}.m3u8`
                    : null,
                message: asset.master?.url 
                    ? 'Download URL ready (expires in 24 hours)'
                    : 'Master URL is being prepared, try again in a few seconds'
            }), { status: 200, headers });
        }

        // GET with action=refresh - Re-fetch all assets from Mux and update index
        if (request.method === 'GET' && action === 'refresh') {
            // Get existing index to preserve user edits (tags, notes, custom titles)
            const existingIndex = await store.get("recordings-index", { type: "json" }) || [];
            const existingMap = new Map(existingIndex.map(r => [r.assetId, r]));
            
            // Get config for stream lookups and auto-tagging
            let config = await store.get("config", { type: "json" });
            
            // Build lookup maps from config (NO hardcoded IDs - fully dynamic)
            // Map 1: liveStreamId → stream name
            // Map 2: stream name → stream config (for auto-tagging)
            const streamNamesByLiveId = {};
            const streamConfigByName = {};
            
            if (config?.streams) {
                config.streams.forEach(s => {
                    if (s.liveStreamId && s.name && s.liveStreamId !== 'ENTER_LIVE_STREAM_ID') {
                        streamNamesByLiveId[s.liveStreamId] = s.name;
                    }
                    if (s.name) {
                        streamConfigByName[s.name] = s;
                    }
                });
            }

            // Fetch all assets from Mux
            const auth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');
            const assetsResponse = await fetch(
                'https://api.mux.com/video/v1/assets?limit=100',
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${auth}`
                    }
                }
            );

            if (!assetsResponse.ok) {
                throw new Error(`Mux API error: ${assetsResponse.status}`);
            }

            const assetsData = await assetsResponse.json();
            const recordings = [];

            for (const asset of assetsData.data) {
                // Only include recordings from live streams
                if (asset.live_stream_id) {
                    // STREAM NAME PRIORITY:
                    // 1. Mux passthrough field (set when livestream created - most reliable)
                    // 2. Config lookup by liveStreamId (if configured in Play settings)
                    // 3. "Recording" as last resort (never "Unknown Stage")
                    const streamName = asset.passthrough || 
                                       streamNamesByLiveId[asset.live_stream_id] || 
                                       'Recording';
                    
                    // Parse timestamp - Mux returns Unix seconds as string
                    const timestamp = parseInt(asset.created_at);
                    const createdDate = new Date(timestamp * 1000);
                    
                    // Format for Sydney timezone
                    const sydneyTime = createdDate.toLocaleString('en-AU', {
                        timeZone: 'Australia/Sydney',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });

                    // Calculate duration
                    const durationMins = asset.duration ? Math.round(asset.duration / 60) : 0;
                    const durationStr = durationMins > 0 ? `${durationMins} mins` : 'Processing...';

                    // Generate fresh title from Mux data (ignore corrupt meta.title)
                    const freshTitle = `${streamName} - ${sydneyTime}`;
                    
                    // Check if user has manually edited this recording
                    const existing = existingMap.get(asset.id);
                    const userEditedTitle = existing?.title && 
                                           !existing.title.includes('Unknown Stage') &&
                                           !existing.title.includes('21/01/1970') &&
                                           existing.title !== existing.streamName + ' - ' + existing.createdFormatted;

                    // AUTO-TAGGING:
                    // If user hasn't manually tagged, check if stream config has a default tag
                    let autoTag = null;
                    if (!existing?.tag) {
                        const streamConfig = streamConfigByName[streamName];
                        if (streamConfig?.tag) {
                            autoTag = streamConfig.tag;
                        }
                    }

                    recordings.push({
                        assetId: asset.id,
                        playbackId: asset.playback_ids?.[0]?.id || null,
                        liveStreamId: asset.live_stream_id,
                        streamName,
                        title: userEditedTitle ? existing.title : freshTitle,
                        externalId: asset.meta?.external_id || null,
                        createdAt: asset.created_at,
                        createdFormatted: sydneyTime,
                        duration: asset.duration || 0,
                        durationStr,
                        status: asset.status,
                        // Preserve user tag OR apply auto-tag from stream config
                        tag: existing?.tag || autoTag,
                        notes: existing?.notes || null
                    });
                }
            }

            // Sort by date (newest first)
            recordings.sort((a, b) => parseInt(b.createdAt) - parseInt(a.createdAt));

            // Save to index
            await store.setJSON("recordings-index", recordings);

            return new Response(JSON.stringify({
                success: true,
                message: 'Recordings index refreshed from Mux',
                count: recordings.length,
                recordings
            }), { status: 200, headers });
        }

        // POST - Handle update/delete actions
        if (request.method === 'POST') {
            const body = await request.json();
            const { action: postAction, assetId } = body;

            // DELETE recording from Mux
            if (postAction === 'delete' && assetId) {
                const auth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');
                
                const deleteResponse = await fetch(
                    `https://api.mux.com/video/v1/assets/${assetId}`,
                    {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Basic ${auth}`
                        }
                    }
                );

                if (!deleteResponse.ok && deleteResponse.status !== 404) {
                    throw new Error(`Mux delete failed: ${deleteResponse.status}`);
                }

                // Remove from local index
                let recordings = await store.get("recordings-index", { type: "json" }) || [];
                recordings = recordings.filter(r => r.assetId !== assetId);
                await store.setJSON("recordings-index", recordings);

                return new Response(JSON.stringify({
                    success: true,
                    message: 'Recording deleted',
                    assetId
                }), { status: 200, headers });
            }

            // UPDATE recording metadata
            if (postAction === 'update' && assetId) {
                const { title, externalId, notes, tag } = body;
                const auth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');
                
                // Build passthrough for notes (Mux stores this as JSON string)
                const passthrough = (notes || tag) ? JSON.stringify({ notes, tag }) : undefined;

                // Update Mux asset metadata (only title and external_id are supported by Mux)
                if (title || externalId) {
                    const updateResponse = await fetch(
                        `https://api.mux.com/video/v1/assets/${assetId}`,
                        {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Basic ${auth}`
                            },
                            body: JSON.stringify({
                                meta: {
                                    title: title || undefined,
                                    external_id: externalId || undefined
                                },
                                passthrough: passthrough
                            })
                        }
                    );

                    if (!updateResponse.ok) {
                        const errText = await updateResponse.text();
                        console.error('[recordings] Mux update error:', errText);
                        // Don't fail completely, still update local index
                    }
                }

                // Update local index (this is where notes and tags are stored)
                let recordings = await store.get("recordings-index", { type: "json" }) || [];
                const idx = recordings.findIndex(r => r.assetId === assetId);
                if (idx !== -1) {
                    if (title !== undefined) recordings[idx].title = title;
                    if (externalId !== undefined) recordings[idx].externalId = externalId;
                    if (notes !== undefined) recordings[idx].notes = notes;
                    if (tag !== undefined) recordings[idx].tag = tag;
                    await store.setJSON("recordings-index", recordings);
                }

                return new Response(JSON.stringify({
                    success: true,
                    message: 'Recording updated',
                    assetId
                }), { status: 200, headers });
            }

            return new Response(JSON.stringify({
                success: false,
                error: 'Invalid POST action'
            }), { status: 400, headers });
        }

        return new Response(JSON.stringify({
            success: false,
            error: 'Invalid request'
        }), { status: 400, headers });

    } catch (error) {
        console.error('[recordings] Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), { status: 500, headers });
    }
}
