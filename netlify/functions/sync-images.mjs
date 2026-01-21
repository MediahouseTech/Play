import { getStore } from "@netlify/blobs";

export default async function handler(req, context) {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
    }

    const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID || '7952c3b8-1fba-4bf8-b95a-219aee11cfe6';
    const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET || 'kIT/Bs5wfBOIkVjljFAFT/EjqxVFKJ+kmKKyFXXRuRIO3HyyES5OZUBpXwfmezViqwnLCPGN0E8';

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'preview';

    try {
        // Get config from Netlify Blobs
        const store = getStore("dashboard-config");
        const configData = await store.get("config", { type: "json" });

        if (!configData || !configData.streams) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'No streams configured' 
            }), { status: 400, headers });
        }

        // Determine base URL for images
        // Use the site URL from the request, or fall back to production
        const siteUrl = url.origin.includes('localhost') 
            ? 'https://play.mediahouse.com.au'
            : url.origin;

        const results = [];

        for (let i = 0; i < configData.streams.length; i++) {
            const stream = configData.streams[i];
            const streamNum = i + 1;
            
            if (!stream.liveStreamId) {
                results.push({
                    stream: streamNum,
                    name: stream.name || `Stream ${streamNum}`,
                    status: 'skipped',
                    reason: 'No Live Stream ID configured'
                });
                continue;
            }

            const slateUrl = `${siteUrl}/images/slate-${streamNum}.jpg`;
            const posterUrl = `${siteUrl}/images/poster-${streamNum}.jpg`;

            if (action === 'preview') {
                results.push({
                    stream: streamNum,
                    name: stream.name || `Stream ${streamNum}`,
                    liveStreamId: stream.liveStreamId,
                    slateUrl: slateUrl,
                    posterUrl: posterUrl,
                    status: 'preview',
                    action: 'Would update Mux with reconnect_slate_url'
                });
            } else if (action === 'apply') {
                // Actually update Mux
                try {
                    const muxResponse = await fetch(
                        `https://api.mux.com/video/v1/live-streams/${stream.liveStreamId}`,
                        {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Basic ' + btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`)
                            },
                            body: JSON.stringify({
                                reconnect_slate_url: slateUrl,
                                use_slate_for_standard_latency: true
                            })
                        }
                    );

                    if (muxResponse.ok) {
                        const muxData = await muxResponse.json();
                        results.push({
                            stream: streamNum,
                            name: stream.name || `Stream ${streamNum}`,
                            liveStreamId: stream.liveStreamId,
                            slateUrl: slateUrl,
                            status: 'success',
                            message: 'Mux updated with slate image'
                        });
                    } else {
                        const errorText = await muxResponse.text();
                        results.push({
                            stream: streamNum,
                            name: stream.name || `Stream ${streamNum}`,
                            liveStreamId: stream.liveStreamId,
                            status: 'error',
                            error: `Mux API error: ${muxResponse.status} - ${errorText}`
                        });
                    }
                } catch (muxError) {
                    results.push({
                        stream: streamNum,
                        name: stream.name || `Stream ${streamNum}`,
                        liveStreamId: stream.liveStreamId,
                        status: 'error',
                        error: muxError.message
                    });
                }
            }
        }

        return new Response(JSON.stringify({
            success: true,
            action: action,
            siteUrl: siteUrl,
            results: results,
            message: action === 'preview' 
                ? 'Preview only - no changes made. Use ?action=apply to update Mux.'
                : 'Sync complete. Slate images updated in Mux.'
        }), { status: 200, headers });

    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), { status: 500, headers });
    }
}

export const config = {
    path: "/api/sync-images"
};
