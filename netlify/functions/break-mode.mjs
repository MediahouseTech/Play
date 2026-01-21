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
            // New format: each stream is { onBreak: bool, activeSlot: 1|2|null }
            if (!breakState) {
                breakState = {
                    "0": { onBreak: false, activeSlot: null },
                    "1": { onBreak: false, activeSlot: null },
                    "2": { onBreak: false, activeSlot: null },
                    "3": { onBreak: false, activeSlot: null },
                    lastUpdated: new Date().toISOString()
                };
                await store.setJSON("break-mode", breakState);
            }
            
            // Migration: convert old boolean format to new object format
            let needsMigration = false;
            for (const key of ['0', '1', '2', '3']) {
                if (typeof breakState[key] === 'boolean') {
                    breakState[key] = { onBreak: breakState[key], activeSlot: breakState[key] ? 1 : null };
                    needsMigration = true;
                }
            }
            if (needsMigration) {
                delete breakState.fallbackPlaybackId; // Remove legacy field
                breakState.lastUpdated = new Date().toISOString();
                await store.setJSON("break-mode", breakState);
                console.log('[break-mode] Migrated to new slot format');
            }

            console.log('[break-mode] GET:', JSON.stringify(breakState));

            return new Response(JSON.stringify({
                success: true,
                breakMode: breakState
            }), { status: 200, headers });
        }

        // POST - Set break mode for a stream
        // Body: { streamIndex: 0-3, isOnBreak: bool, slot: 1|2|null }
        // slot is required when isOnBreak is true, ignored when false
        if (request.method === 'POST') {
            const body = await request.json();
            const { streamIndex, isOnBreak, slot } = body;

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
            
            // Validate slot when going on break
            if (isOnBreak && slot !== 1 && slot !== 2) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Missing or invalid slot. Must be 1 or 2 when going on break.'
                }), { status: 400, headers });
            }

            // Get current state
            let breakState = await store.get("break-mode", { type: "json" });
            if (!breakState) {
                breakState = {
                    "0": { onBreak: false, activeSlot: null },
                    "1": { onBreak: false, activeSlot: null },
                    "2": { onBreak: false, activeSlot: null },
                    "3": { onBreak: false, activeSlot: null }
                };
            }
            
            // Migrate old format if needed
            if (typeof breakState[index] === 'boolean') {
                breakState[index] = { onBreak: breakState[index], activeSlot: null };
            }

            // Update the specific stream
            breakState[index] = {
                onBreak: Boolean(isOnBreak),
                activeSlot: isOnBreak ? slot : null
            };
            breakState.lastUpdated = new Date().toISOString();
            breakState.updatedBy = body.updatedBy || 'producer';

            // Save back to store
            await store.setJSON("break-mode", breakState);

            const slotMsg = isOnBreak ? ` (Slot ${slot})` : '';
            console.log(`[break-mode] POST: Stream ${index} set to ${isOnBreak ? 'BREAK' + slotMsg : 'LIVE'}`);

            return new Response(JSON.stringify({
                success: true,
                breakMode: breakState,
                message: `Stream ${index} is now ${isOnBreak ? 'ON BREAK' + slotMsg : 'LIVE'}`
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
