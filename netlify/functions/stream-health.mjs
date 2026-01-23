/**
 * STREAM-HEALTH.MJS - Mux Live Stream Health Stats API
 * Returns connection strength indicator for live streams
 * 
 * Requires JWT authentication to Mux Stats API
 * Returns: status (excellent/good/poor/unknown)
 */

import jwt from 'jsonwebtoken';

export default async function handler(req, context) {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
    }

    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers
        });
    }

    try {
        const url = new URL(req.url);
        const liveStreamId = url.searchParams.get('liveStreamId');

        if (!liveStreamId) {
            return new Response(JSON.stringify({ 
                error: 'liveStreamId required',
                status: 'unknown'
            }), { status: 400, headers });
        }

        // Get Mux signing key from environment
        const signingKeyId = process.env.MUX_SIGNING_KEY_ID;
        const signingKeySecret = process.env.MUX_SIGNING_KEY_SECRET;

        // If no signing key configured, return unknown status
        if (!signingKeyId || !signingKeySecret) {
            console.log('[stream-health] No signing key configured - returning unknown');
            return new Response(JSON.stringify({
                success: true,
                status: 'unknown',
                message: 'Health stats not configured'
            }), { status: 200, headers });
        }

        // Decode the base64 private key
        const privateKey = Buffer.from(signingKeySecret, 'base64').toString('utf-8');

        // Create JWT token for Mux Stats API
        const token = jwt.sign(
            {
                sub: liveStreamId,
                aud: 'live_stream_id',
                exp: Math.floor(Date.now() / 1000) + (60 * 15), // 15 minutes
                kid: signingKeyId
            },
            privateKey,
            { algorithm: 'RS256' }
        );

        // Call Mux Stats API
        const statsResponse = await fetch(`https://stats.mux.com/live-stream-health?token=${token}`);

        if (!statsResponse.ok) {
            console.log(`[stream-health] Mux API error: ${statsResponse.status}`);
            return new Response(JSON.stringify({
                success: true,
                status: 'unknown',
                error: `Mux API returned ${statsResponse.status}`
            }), { status: 200, headers });
        }

        const statsData = await statsResponse.json();

        // Extract health status from response
        const healthData = statsData.data?.[0]?.ingest_health;
        
        if (!healthData) {
            return new Response(JSON.stringify({
                success: true,
                status: 'unknown',
                message: 'No health data available'
            }), { status: 200, headers });
        }

        return new Response(JSON.stringify({
            success: true,
            status: healthData.status || 'unknown',
            sessionAvg: healthData.stream_drift_session_avg,
            deviation: healthData.stream_drift_deviation_from_rolling_avg,
            updatedAt: healthData.updated_at
        }), { status: 200, headers });

    } catch (error) {
        console.error('[stream-health] Error:', error);
        return new Response(JSON.stringify({
            success: false,
            status: 'unknown',
            error: error.message
        }), { status: 200, headers }); // Return 200 with unknown status to not break UI
    }
}
