/**
 * CREATE-LIVESTREAM.MJS - Create new Mux Live Stream
 * 
 * POST /api/create-livestream
 * Body: { "name": "Main Stage" }
 * 
 * Returns: liveStreamId, playbackId, streamKey, rtmpUrl
 */

export default async function handler(request, context) {
    const MUX_TOKEN_ID = '7952c3b8-1fba-4bf8-b95a-219aee11cfe6';
    const MUX_TOKEN_SECRET = 'kIT/Bs5wfBOIkVjljFAFT/EjqxVFKJ+kmKKyFXXRuRIO3HyyES5OZUBpXwfmezViqwnLCPGN0E8';

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({
            success: false,
            error: 'Method not allowed'
        }), { status: 405, headers });
    }

    try {
        const body = await request.json();
        const streamName = body.name || 'Unnamed Stream';

        const auth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');

        // Create live stream with recording enabled
        const response = await fetch('https://api.mux.com/video/v1/live-streams', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                playback_policy: ['public'],
                new_asset_settings: {
                    playback_policy: ['public']
                },
                latency_mode: 'low',
                reconnect_window: 60,
                passthrough: streamName
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[create-livestream] Mux API error:', errorText);
            return new Response(JSON.stringify({
                success: false,
                error: `Mux API error: ${response.status}`,
                details: errorText
            }), { status: 500, headers });
        }

        const data = await response.json();
        const liveStream = data.data;

        // Extract the values we need
        const result = {
            success: true,
            liveStreamId: liveStream.id,
            playbackId: liveStream.playback_ids?.[0]?.id || '',
            streamKey: liveStream.stream_key,
            rtmpUrl: 'rtmp://global-live.mux.com:5222/app',
            name: streamName
        };

        console.log('[create-livestream] Created:', result.liveStreamId);

        return new Response(JSON.stringify(result), { status: 200, headers });

    } catch (error) {
        console.error('[create-livestream] Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), { status: 500, headers });
    }
}
