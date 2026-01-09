/**
 * MUX-WEBHOOK.MJS - Auto-Tag Recordings with Stage Names
 * 
 * Receives webhooks from Mux when recordings are ready.
 * Automatically adds metadata (title, external_id, creator_id) so you can
 * identify recordings by stage name and timestamp in post-production.
 * 
 * Webhook event: video.asset.ready
 * 
 * Example metadata added:
 *   title: "Main Stage - 2025-01-26 14:23"
 *   creator_id: "Yabun-2025"
 *   external_id: "main-stage-session-001"
 */

import { getStore } from "@netlify/blobs";

// Mux API credentials (same as stream-status.mjs)
const MUX_TOKEN_ID = '7952c3b8-1fba-4bf8-b95a-219aee11cfe6';
const MUX_TOKEN_SECRET = 'kIT/Bs5wfBOIkVjljFAFT/EjqxVFKJ+kmKKyFXXRuRIO3HyyES5OZUBpXwfmezViqwnLCPGN0E8';

export default async function handler(request, context) {
    // Only accept POST requests
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const payload = await request.json();
        
        console.log('[mux-webhook] Received event:', payload.type);
        
        // Only process video.asset.ready events
        if (payload.type !== 'video.asset.ready') {
            console.log('[mux-webhook] Ignoring event type:', payload.type);
            return new Response(JSON.stringify({ 
                success: true, 
                message: 'Event ignored (not video.asset.ready)' 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const assetData = payload.data;
        const assetId = assetData.id;
        const liveStreamId = assetData.live_stream_id;
        const createdAt = assetData.created_at;
        const duration = assetData.duration;

        console.log('[mux-webhook] Asset ready:', {
            assetId,
            liveStreamId,
            duration: Math.round(duration / 60) + ' minutes'
        });

        // Only process assets that came from a live stream
        if (!liveStreamId) {
            console.log('[mux-webhook] Not a live stream recording, skipping metadata update');
            return new Response(JSON.stringify({ 
                success: true, 
                message: 'Not a live stream recording' 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get our dashboard config to look up stage names
        const store = getStore("yabun-dashboard");
        let config = await store.get("config", { type: "json" });

        // Find which stage this Live Stream ID belongs to
        let stageName = "Unknown Stage";
        let stageIndex = -1;
        
        if (config && config.streams) {
            for (let i = 0; i < config.streams.length; i++) {
                if (config.streams[i].liveStreamId === liveStreamId) {
                    stageName = config.streams[i].name;
                    stageIndex = i;
                    break;
                }
            }
        }

        console.log('[mux-webhook] Matched stage:', stageName, '(index:', stageIndex, ')');

        // Format timestamp for title (Sydney timezone)
        const assetDate = new Date(createdAt);
        const sydneyTime = assetDate.toLocaleString('en-AU', {
            timeZone: 'Australia/Sydney',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        // Format duration
        const durationMins = Math.round(duration / 60);
        const durationStr = durationMins > 60 
            ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`
            : `${durationMins}m`;

        // Build metadata
        const eventName = config?.eventName || 'Yabun Festival 2025';
        const title = `${stageName} - ${sydneyTime} (${durationStr})`;
        const creatorId = eventName.replace(/\s+/g, '-');
        
        // Track session number per stage
        let sessionCounter = await store.get("session-counter", { type: "json" }) || {};
        const stageKey = stageName.toLowerCase().replace(/\s+/g, '-');
        sessionCounter[stageKey] = (sessionCounter[stageKey] || 0) + 1;
        await store.setJSON("session-counter", sessionCounter);
        
        const externalId = `${stageKey}-session-${String(sessionCounter[stageKey]).padStart(3, '0')}`;

        console.log('[mux-webhook] Updating asset metadata:', {
            title,
            creatorId,
            externalId
        });

        // Call Mux API to update asset metadata
        const auth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');
        const muxResponse = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: JSON.stringify({
                meta: {
                    title: title,
                    creator_id: creatorId,
                    external_id: externalId
                }
            })
        });

        if (!muxResponse.ok) {
            const errorText = await muxResponse.text();
            console.error('[mux-webhook] Mux API error:', muxResponse.status, errorText);
            throw new Error(`Mux API error: ${muxResponse.status}`);
        }

        const muxData = await muxResponse.json();
        console.log('[mux-webhook] ✅ Asset metadata updated successfully');

        // Log to our recordings index for easy retrieval
        let recordingsIndex = await store.get("recordings-index", { type: "json" }) || [];
        recordingsIndex.push({
            assetId,
            playbackId: assetData.playback_ids?.[0]?.id || null,
            liveStreamId,
            stageName,
            stageIndex,
            title,
            externalId,
            createdAt,
            duration,
            durationStr,
            addedAt: new Date().toISOString()
        });
        await store.setJSON("recordings-index", recordingsIndex);

        return new Response(JSON.stringify({
            success: true,
            message: 'Asset metadata updated',
            assetId,
            metadata: { title, creatorId, externalId }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[mux-webhook] Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
