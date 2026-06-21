import { json } from '@sveltejs/kit';
import openapi from '$lib/openapi.json';
import { getDb } from '$lib/server/db.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'public, max-age=3600'
};

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function GET({ request, url }) {
    try {
        const db = await getDb();
        const debugCol = db.collection('mcp_debug_logs');
        /** @type {Record<string, string>} */
        const headersObj = {};
        for (const [k, v] of request.headers.entries()) {
            if (k.toLowerCase() === 'authorization') {
                headersObj[k] = v.substring(0, 15) + '...';
            } else {
                headersObj[k] = v;
            }
        }
        await debugCol.insertOne({
            timestamp: new Date(),
            method: 'GET',
            url: url.toString(),
            endpoint: 'openapi.json',
            headers: headersObj
        });
    } catch (e) {
        console.error('[MCP Debug Log] Failed to write openapi.json GET log:', e);
    }

    return json(openapi, {
        headers: corsHeaders
    });
}

