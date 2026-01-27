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
        const store = getStore("dashboard-config");
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

            const auth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');
            
            // Step 1: Enable master access
            console.log(`[recordings] Enabling master access for: ${assetId}`);
            const enableResponse = await fetch(
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
            
            const enableText = await enableResponse.text();
            console.log(`[recordings] Enable response (${enableResponse.status}): ${enableText}`);
            
            // 400 with "already exists" is OK - means it's already enabled
            if (!enableResponse.ok && !enableText.toLowerCase().includes('already')) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `Failed to enable download: ${enableText}`
                }), { status: 500, headers });
            }

            // Step 2: Poll for master URL (up to 30 seconds)
            console.log(`[recordings] Polling for master URL...`);
            for (let attempt = 1; attempt <= 30; attempt++) {
                const assetResponse = await fetch(
                    `https://api.mux.com/video/v1/assets/${assetId}`,
                    {
                        method: 'GET',
                        headers: { 'Authorization': `Basic ${auth}` }
                    }
                );

                if (!assetResponse.ok) {
                    return new Response(JSON.stringify({
                        success: false,
                        error: `Asset not found (${assetResponse.status})`
                    }), { status: 404, headers });
                }

                const assetData = await assetResponse.json();
                const asset = assetData.data;
                
                // Check if master URL is ready
                if (asset.master?.url) {
                    console.log(`[recordings] SUCCESS! Master URL ready after ${attempt}s`);
                    return new Response(JSON.stringify({
                        success: true,
                        assetId: asset.id,
                        duration: asset.duration,
                        downloadUrl: asset.master.url,
                        message: 'Download URL ready (expires in 24 hours)'
                    }), { status: 200, headers });
                }
                
                // Log progress
                if (attempt % 5 === 0 || attempt === 1) {
                    console.log(`[recordings] Attempt ${attempt}/30 - master_access: ${asset.master_access}, master.status: ${asset.master?.status || 'none'}`);
                }
                
                // Wait 1 second
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Timeout
            console.error(`[recordings] TIMEOUT after 30s - master URL never became ready`);
            return new Response(JSON.stringify({
                success: false,
                error: 'Download preparation timed out after 30 seconds. Please try again.'
            }), { status: 503, headers });
        }

        // GET with action=debug - Show tag configuration for debugging
        if (request.method === 'GET' && action === 'debug') {
            let config = await store.get("config", { type: "json" });
            
            const streamTags = config?.streams?.map(s => ({
                name: s.name,
                tag: s.tag || '(empty)',
                liveStreamId: s.liveStreamId?.substring(0, 12) + '...'
            })) || [];
            
            return new Response(JSON.stringify({
                success: true,
                message: 'Tag configuration debug info',
                configExists: !!config,
                configKeys: config ? Object.keys(config) : [],
                streamsCount: config?.streams?.length || 0,
                streamTags,
                rawStreams: config?.streams?.map(s => ({ name: s.name, tag: s.tag }))
            }, null, 2), { status: 200, headers });
        }

        // GET with action=refresh - Re-fetch all assets from Mux and update index
        // GET with action=refresh&force=true - Clear cache first, then rebuild
        if (request.method === 'GET' && action === 'refresh') {
            const forceRefresh = url.searchParams.get('force') === 'true';
            
            // Get existing index to preserve user edits (tags, notes, custom titles)
            // Unless force=true, in which case we start fresh
            let existingIndex = [];
            if (!forceRefresh) {
                existingIndex = await store.get("recordings-index", { type: "json" }) || [];
            } else {
                console.log('[recordings] Force refresh - clearing cached index');
            }
            const existingMap = new Map(existingIndex.map(r => [r.assetId, r]));
            
            // Get config for stream lookups and auto-tagging
            let config = await store.get("config", { type: "json" });
            
            // Build lookup maps from config (NO hardcoded IDs - fully dynamic)
            // Map 1: liveStreamId → stream name
            // Map 2: stream name → stream config (for auto-tagging)
            // Map 3: liveStreamId → stream config (for direct auto-tagging)
            const streamNamesByLiveId = {};
            const streamConfigByName = {};
            const streamConfigByLiveId = {};
            
            if (config?.streams) {
                config.streams.forEach(s => {
                    if (s.liveStreamId && s.name && s.liveStreamId !== 'ENTER_LIVE_STREAM_ID') {
                        streamNamesByLiveId[s.liveStreamId] = s.name;
                        streamConfigByLiveId[s.liveStreamId] = s;
                    }
                    if (s.name) {
                        streamConfigByName[s.name] = s;
                    }
                });
            }
            
            console.log('[recordings] Stream tag config:', JSON.stringify(config?.streams?.map(s => ({ name: s.name, tag: s.tag, liveStreamId: s.liveStreamId?.substring(0, 12) }))));
            console.log('[recordings] Config liveStreamIds:', Object.keys(streamConfigByLiveId));

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

            console.log('[recordings] Processing', assetsData.data.length, 'assets from Mux');

            for (const asset of assetsData.data) {
                // Only include recordings from live streams
                if (asset.live_stream_id) {
                    // DEBUG: Log what Mux is returning
                    console.log('[recordings] Asset:', asset.id, '| live_stream_id:', asset.live_stream_id, '| passthrough:', asset.passthrough, '| duration:', asset.duration, '| created_at:', asset.created_at, '| status:', asset.status);
                    
                    // Also log available stream IDs from config for comparison
                    console.log('[recordings] Config liveStreamIds:', Object.keys(streamNamesByLiveId));
                    
                    // STREAM NAME PRIORITY:
                    // 1. Mux passthrough field (set when livestream created - most reliable)
                    // 2. Config lookup by liveStreamId (if configured in Play settings)
                    // 3. "Recording" as last resort (never "Unknown Stage")
                    const streamName = asset.passthrough || 
                                       streamNamesByLiveId[asset.live_stream_id] || 
                                       'Recording';
                    
                    console.log('[recordings] streamName resolved to:', streamName);
                    
                    // Parse timestamp - handle multiple formats from Mux
                    let createdDate;
                    const rawCreatedAt = asset.created_at;
                    
                    if (typeof rawCreatedAt === 'number') {
                        // Unix timestamp in seconds
                        createdDate = new Date(rawCreatedAt * 1000);
                    } else if (typeof rawCreatedAt === 'string') {
                        // Try parsing as Unix timestamp first
                        const parsed = parseInt(rawCreatedAt);
                        if (!isNaN(parsed) && parsed > 1000000000) {
                            // Valid Unix timestamp (after 2001)
                            createdDate = new Date(parsed * 1000);
                        } else {
                            // Try as ISO string
                            createdDate = new Date(rawCreatedAt);
                        }
                    } else {
                        // Fallback to now
                        createdDate = new Date();
                    }
                    
                    // Validate the date - if invalid, use current time
                    if (isNaN(createdDate.getTime()) || createdDate.getFullYear() < 2020) {
                        console.log('[recordings] Invalid date detected, using current time. Raw value:', rawCreatedAt);
                        createdDate = new Date();
                    }
                    
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
                    // Mux takes 1-3 minutes to finalize recordings after stream ends
                    const isProcessing = asset.status !== 'ready' || !asset.duration || asset.duration < 1;
                    const durationMins = asset.duration ? Math.round(asset.duration / 60) : 0;
                    const durationStr = isProcessing ? 'Finalizing...' : (durationMins > 0 ? `${durationMins} mins` : '< 1 min');

                    // Generate fresh title from Mux data (ignore corrupt meta.title)
                    const freshTitle = `${streamName} - ${sydneyTime}`;
                    
                    // Check if user has manually edited this recording
                    // Bad patterns that indicate auto-generated titles that need regeneration
                    const existing = existingMap.get(asset.id);
                    const hasBadTitle = existing?.title && (
                        existing.title.includes('Unknown Stage') ||
                        existing.title.includes('Unknown') ||
                        existing.title.includes('1970') ||
                        existing.title.includes('(0m)') ||
                        existing.title.includes('21:23') ||
                        existing.title.includes('21:22') ||
                        existing.title.includes('21:21')
                    );
                    
                    // Only preserve title if user manually edited AND it doesn't have bad patterns
                    const userEditedTitle = existing?.title && 
                                           !hasBadTitle &&
                                           existing.title !== existing.streamName + ' - ' + existing.createdFormatted;

                    // AUTO-TAGGING:
                    // If user hasn't manually tagged, apply tag from stream config
                    // Use liveStreamId lookup (most reliable) or fall back to name lookup
                    let autoTag = null;
                    if (!existing?.tag) {
                        // Try direct liveStreamId lookup first
                        const streamConfigById = streamConfigByLiveId[asset.live_stream_id];
                        const streamConfigByNameLookup = streamConfigByName[streamName];
                        const streamConfig = streamConfigById || streamConfigByNameLookup;
                        
                        console.log(`[recordings] Tag lookup for ${streamName}: configById=${!!streamConfigById}, configByName=${!!streamConfigByNameLookup}, tag=${streamConfig?.tag || 'NONE'}`);
                        
                        if (streamConfig?.tag) {
                            autoTag = streamConfig.tag;
                            console.log(`[recordings] Auto-tagging ${streamName} with tag: "${autoTag}"`);
                        } else {
                            console.log(`[recordings] No auto-tag for ${streamName} - streamConfig.tag is empty or undefined`);
                        }
                    } else {
                        console.log(`[recordings] Skipping auto-tag for ${streamName} - already has tag: "${existing.tag}"`);
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
