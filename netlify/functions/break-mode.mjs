/**
 * BREAK-MODE.MJS - Manual Break Mode Control
 * 
 * Allows producers to manually switch streams between LIVE and BREAK modes.
 * When in BREAK mode, all viewers see the fallback video instead of live stream.
 * 
 * GET  /api/break-mode - Returns current break state for all streams
 * POST /api/break-mode - Sets break mode for a specific stream
 * 
 * Break state stored in Netlify Blobs under key "break-mode"
 */

import { getStore } from "@netlify/blobs";

export default async function handler(request, context) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'no-store, no-cache, must-revalidate'
            }
        });
    }

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
    };

    try {
        // Get the Netlify Blobs store
        const store = getStore("yabun-dashboard");

        // GET - Return current break states
        if (request.method === 'GET') {
            let breakState = await store.get("break-mode", { type: "json" });
            
            // Initialize default state if none exists
            if (!breakState) {
                breakState = {
                    "0": false,
                    "1": false,
                    "2": false,
                    "3": false,
                    fallbackPlaybackId: "mbX0201BRcVnkh802Fb00UHWbRUpNgV64lM029iBmuHLqe1g",
                    lastUpdated: new Date().toISOString()
                };
                await store.setJSON("break-mode", breakState);
            }

            console.log('[break-mode] GET:', JSON.stringify(breakState));

            return new Response(JSON.stringify({
                success: true,
                breakMode: breakState
            }), { status: 200, headers });
        }

        // POST - Set break mode for a stream
        if (request.method === 'POST') {
            const body = await request.json();
            const { streamIndex, isOnBreak } = body;

            // Validate input
            if (streamIndex === undefined || isOnBreak === undefined) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Missing streamIndex or isOnBreak parameter'
                }), { status: 400, headers });
            }

            // Validate stream index (0-3)
            const index = String(streamIndex);
            if (!['0', '1', '2', '3'].includes(index)) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Invalid streamIndex. Must be 0-3.'
                }), { status: 400, headers });
            }

            // Get current state
            let breakState = await store.get("break-mode", { type: "json" });
            if (!breakState) {
                breakState = {
                    "0": false,
                    "1": false,
                    "2": false,
                    "3": false,
                    fallbackPlaybackId: "mbX0201BRcVnkh802Fb00UHWbRUpNgV64lM029iBmuHLqe1g"
                };
            }

            // Update the specific stream
            breakState[index] = Boolean(isOnBreak);
            breakState.lastUpdated = new Date().toISOString();
            breakState.updatedBy = body.updatedBy || 'producer';

            // Save back to store
            await store.setJSON("break-mode", breakState);

            console.log(`[break-mode] POST: Stream ${index} set to ${isOnBreak ? 'BREAK' : 'LIVE'}`);

            return new Response(JSON.stringify({
                success: true,
                breakMode: breakState,
                message: `Stream ${index} is now ${isOnBreak ? 'ON BREAK' : 'LIVE'}`
            }), { status: 200, headers });
        }

        // Method not allowed
        return new Response(JSON.stringify({
            success: false,
            error: 'Method not allowed'
        }), { status: 405, headers });

    } catch (error) {
        console.error('[break-mode] Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), { status: 500, headers });
    }
}
