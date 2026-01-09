/**
 * STREAM-STATUS.MJS - Check Mux Live Stream Status
 * 
 * Calls Mux API to check if a live stream is actually live (active)
 * or idle (not streaming). This prevents playing recordings when
 * the encoder has stopped.
 * 
 * Returns:
 *   - status: "active" | "idle" | "disabled"
 *   - isLive: true/false
 *   - playbackId: the playback ID checked
 */

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

    // Get Mux credentials (hardcoded temporarily for testing)
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
            // Try query params as fallback
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
        // Call Mux API to get live stream status
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

        // Return status info
        return new Response(JSON.stringify({
            liveStreamId: stream.id,
            status: stream.status,
            isLive: stream.status === 'active',
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
// Trigger redeploy Thu Jan  8 16:52:12 AEDT 2026
// Redeploy 1767851847
