/**
 * STREAM-STATUS.MJS - Check Live Stream Status (INSTANT via webhooks)
 * 
 * PRIORITY ORDER:
 * 1. Check Netlify Blob for encoder state (instant - set by webhooks)
 * 2. Fall back to Mux API if no blob data (60s delay during reconnect window)
 * 
 * Returns:
 *   - status: "active" | "idle" | "disconnected" | "connected"
 *   - isLive: true/false
 *   - source: "webhook" | "api" (so you know if it's instant or delayed)
 */

import { getStore } from "@netlify/blobs";

export default async function handler(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
    }

    // Get Mux credentials
    const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID || '7952c3b8-1fba-4bf8-b95a-219aee11cfe6';
    const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET || 'kIT/Bs5wfBOIkVjljFAFT/EjqxVFKJ+kmKKyFXXRuRIO3HyyES5OZUBpXwfmezViqwnLCPGN0E8';

    if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
        return new Response(JSON.stringify({
            error: 'Mux API credentials not configured'
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    // Get live stream ID from query or body
    let liveStreamId;
    
    if (request.method === 'GET') {
        const url = new URL(request.url);
        liveStreamId = url.searchParams.get('liveStreamId');
    } else if (request.method === 'POST') {
        try {
            const body = await request.json();
            liveStreamId = body.liveStreamId;
        } catch (e) {
            const url = new URL(request.url);
            liveStreamId = url.searchParams.get('liveStreamId');
        }
    }

    if (!liveStreamId) {
        return new Response(JSON.stringify({
            error: 'Missing liveStreamId parameter'
        }), {
            status: 400,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    try {
        // STEP 1: Check Netlify Blob for instant encoder state (from webhooks)
        const store = getStore("yabun-dashboard");
        const encoderStates = await store.get("encoder-states", { type: "json" });
        
        if (encoderStates && encoderStates[liveStreamId]) {
            const webhookState = encoderStates[liveStreamId];
            
            // Only trust webhook for DISCONNECTED or IDLE (instant detection)
            // For connected/active/unknown, fall back to API for accuracy
            if (webhookState.status === 'disconnected' || webhookState.status === 'idle') {
                console.log(`[stream-status] INSTANT (webhook): ${liveStreamId} = ${webhookState.status}`);
                
                return new Response(JSON.stringify({
                    liveStreamId: liveStreamId,
                    status: webhookState.status,
                    isLive: false,
                    source: 'webhook',
                    timestamp: webhookState.timestamp,
                    playbackIds: []
                }), {
                    status: 200,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'no-cache, no-store, must-revalidate'
                    }
                });
            }
            
            // For connected/active, still verify with API but log webhook state
            console.log(`[stream-status] Webhook says ${webhookState.status}, verifying with API...`);
        }

        // STEP 2: Fall back to Mux API (has 60s reconnect window delay)
        console.log(`[stream-status] No webhook data, falling back to Mux API for ${liveStreamId}`);
        
        const auth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');
        
        const response = await fetch(`https://api.mux.com/video/v1/live-streams/${liveStreamId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[stream-status] Mux API error:', response.status, errorText);
            return new Response(JSON.stringify({
                error: 'Failed to fetch stream status',
                details: errorText
            }), {
                status: response.status,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        const data = await response.json();
        const stream = data.data;

        return new Response(JSON.stringify({
            liveStreamId: stream.id,
            status: stream.status,
            isLive: stream.status === 'active',
            source: 'api',
            playbackIds: stream.playback_ids?.map(p => p.id) || [],
            reconnectWindow: stream.reconnect_window,
            createdAt: stream.created_at
        }), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });

    } catch (error) {
        console.error('[stream-status] Error:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

export const config = {
    path: "/api/stream-status"
};
