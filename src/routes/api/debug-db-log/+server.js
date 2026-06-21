import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ request }) {
    try {
        const db = await getDb();
        const debugCol = db.collection('mcp_debug_logs');
        
        console.log('Testing request.headers.entries()...');
        /** @type {Record<string, string>} */
        const headersObj = {};
        for (const [k, v] of request.headers.entries()) {
            headersObj[k] = v;
        }

        const doc = {
            timestamp: new Date(),
            method: 'DEBUG_GET',
            message: 'Direct hit to /api/debug-db-log with headers iteration',
            headers: headersObj
        };
        const result = await debugCol.insertOne(doc);
        return json({ success: true, insertedId: result.insertedId, headers: headersObj });
    } catch (/** @type {any} */ err) {
        return json({ success: false, error: err.message, stack: err.stack }, { status: 500 });
    }
}
