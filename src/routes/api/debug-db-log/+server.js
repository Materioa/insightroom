import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';

/** @type {import('./$types').RequestHandler} */
export async function GET() {
    try {
        const db = await getDb();
        const debugCol = db.collection('mcp_debug_logs');
        const doc = {
            timestamp: new Date(),
            method: 'DEBUG_GET',
            message: 'Direct hit to /api/debug-db-log'
        };
        const result = await debugCol.insertOne(doc);
        return json({ success: true, insertedId: result.insertedId });
    } catch (/** @type {any} */ err) {
        return json({ success: false, error: err.message, stack: err.stack }, { status: 500 });
    }
}
