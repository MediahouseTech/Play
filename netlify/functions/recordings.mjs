/**
 * RECORDINGS.MJS - List All Tagged Recordings
 * 
 * GET /api/recordings - Returns list of all recordings with metadata
 * 
 * Useful for post-production to see all recordings with:
 * - Stage names
 * - Timestamps  
 * - Duration
 * - Direct download links
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
            // Get our config to know which Live Stream IDs to look for
            let config = await store.get("config", { type: "json" });
            
            // Build list of known live stream IDs from config
            // Also include hardcoded Main Stage ID as fallback
            const knownStreamIds = [
                'spDSZGOT2fRmqVkMpvaiPMjnBD1qW8800ghXCHoJojBc' // Main Stage - hardcoded fallback
            ];
            
            if (config?.streams) {
                config.streams.forEach(s => {
                    if (s.liveStreamId && 
                        s.liveStreamId !== 'ENTER_LIVE_STREAM_ID' && 
                        !knownStreamIds.includes(s.liveStreamId)) {
                        knownStreamIds.push(s.liveStreamId);
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

            // Stage name lookup map
            const stageNames = {
                'spDSZGOT2fRmqVkMpvaiPMjnBD1qW8800ghXCHoJojBc': 'Main Stage',
                'x91mPV02jW00EhP6lECoopFnjTri2s02Zip474B9jYO6k00': 'Old Test Stream'
            };
            
            // Add names from config if available
            if (config?.streams) {
                config.streams.forEach(s => {
                    if (s.liveStreamId && s.name) {
                        stageNames[s.liveStreamId] = s.name;
                    }
                });
            }

            for (const asset of assetsData.data) {
                // Include ALL live stream recordings (not just configured ones)
                if (asset.live_stream_id) {
                    const stageName = stageNames[asset.live_stream_id] || 'Unknown Stage';
                    
                    // Format created timestamp
                    const createdDate = new Date(parseInt(asset.created_at) * 1000);
                    const sydneyTime = createdDate.toLocaleString('en-AU', {
                        timeZone: 'Australia/Sydney',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });

                    const durationMins = Math.round(asset.duration / 60);

                    recordings.push({
                        assetId: asset.id,
                        playbackId: asset.playback_ids?.[0]?.id || null,
                        liveStreamId: asset.live_stream_id,
                        stageName,
                        title: asset.meta?.title || `${stageName} - ${sydneyTime}`,
                        externalId: asset.meta?.external_id || null,
                        createdAt: asset.created_at,
                        createdFormatted: sydneyTime,
                        duration: asset.duration,
                        durationStr: durationMins + ' mins',
                        status: asset.status
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
