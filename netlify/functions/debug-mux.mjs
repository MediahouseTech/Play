/**
 * DEBUG-MUX.MJS - Debug Mux Assets (temporary)
 * 
 * Shows ALL assets in Mux without any filtering
 * so we can see what's actually there.
 */

export default async function handler(request, context) {
    const MUX_TOKEN_ID = '7952c3b8-1fba-4bf8-b95a-219aee11cfe6';
    const MUX_TOKEN_SECRET = 'kIT/Bs5wfBOIkVjljFAFT/EjqxVFKJ+kmKKyFXXRuRIO3HyyES5OZUBpXwfmezViqwnLCPGN0E8';

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    try {
        const auth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');
        
        // Get ALL assets (last 20)
        const assetsResponse = await fetch(
            'https://api.mux.com/video/v1/assets?limit=20',
            {
                method: 'GET',
                headers: { 'Authorization': `Basic ${auth}` }
            }
        );

        if (!assetsResponse.ok) {
            const errorText = await assetsResponse.text();
            return new Response(JSON.stringify({
                success: false,
                error: `Mux API error: ${assetsResponse.status}`,
                details: errorText
            }), { status: 500, headers });
        }

        const assetsData = await assetsResponse.json();
        
        // Get ALL live streams
        const streamsResponse = await fetch(
            'https://api.mux.com/video/v1/live-streams?limit=20',
            {
                method: 'GET',
                headers: { 'Authorization': `Basic ${auth}` }
            }
        );
        
        const streamsData = streamsResponse.ok ? await streamsResponse.json() : { data: [] };

        // Format assets for readability
        const assets = assetsData.data.map(a => ({
            id: a.id,
            status: a.status,
            duration: a.duration ? Math.round(a.duration / 60) + ' mins' : 'N/A',
            created: a.created_at,
            live_stream_id: a.live_stream_id || 'NOT FROM LIVE STREAM',
            playback_id: a.playback_ids?.[0]?.id || 'none',
            title: a.meta?.title || 'No title',
            is_live_recording: !!a.live_stream_id
        }));

        // Format live streams
        const streams = streamsData.data.map(s => ({
            id: s.id,
            status: s.status,
            playback_id: s.playback_ids?.[0]?.id || 'none',
            stream_key: s.stream_key ? s.stream_key.substring(0, 10) + '...' : 'none',
            created: s.created_at,
            recent_asset_ids: s.recent_asset_ids || []
        }));

        return new Response(JSON.stringify({
            success: true,
            message: 'Raw Mux data (unfiltered)',
            assets_count: assets.length,
            assets: assets,
            live_streams_count: streams.length,
            live_streams: streams
        }, null, 2), { status: 200, headers });

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), { status: 500, headers });
    }
}
