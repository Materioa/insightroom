import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function POST({ request, fetch }) {
    // Claude and other AI clients sometimes force the Token URL to be on the same domain as the API.
    // This proxy forwards the token exchange request to the actual Materio token endpoint.
    let rpcBody = null;
    /** @type {Record<string, string>} */
    let headersLog = {};
    try {
        for (const [k, v] of request.headers.entries()) {
            if (k.toLowerCase() === 'authorization') {
                headersLog[k] = v.substring(0, 15) + '...';
            } else {
                headersLog[k] = v;
            }
        }
        
        const contentType = request.headers.get('content-type') || '';
        let body;
        
        if (contentType.includes('application/json')) {
            body = await request.json();
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await request.formData();
            body = Object.fromEntries(formData);
        } else {
            return json({ error: 'Unsupported content type' }, { status: 400 });
        }

        rpcBody = body;

        const headers = new Headers();
        headers.set('Content-Type', 'application/json');
        const authHeader = request.headers.get('authorization');
        if (authHeader) {
            headers.set('Authorization', authHeader);
        }

        const authBaseUrl = env.AUTH_URL || 'https://materioa.vercel.app';
        const res = await fetch(`${authBaseUrl}/api/v2/auth?action=oauth_token`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        let responseBodyText = '';
        let data = {};
        try {
            responseBodyText = await res.text();
            data = JSON.parse(responseBodyText);
        } catch (e) {
            data = { error: responseBodyText || 'Failed to parse response as JSON' };
        }

        // Log token exchange to MongoDB for debugging
        try {
            const db = await getDb();
            const debugCol = db.collection('mcp_debug_logs');
            await debugCol.insertOne({
                timestamp: new Date(),
                method: 'POST-TOKEN-PROXY',
                url: `${authBaseUrl}/api/v2/auth?action=oauth_token`,
                headers: headersLog,
                requestBody: rpcBody,
                responseStatus: res.status,
                responseBody: data
            });
        } catch (dbErr) {
            console.error('[Token Proxy Log Error]', dbErr);
        }

        return json(data, { 
            status: res.status,
            headers: {
                ...corsHeaders,
                'Cache-Control': 'no-store',
                'Pragma': 'no-cache'
            }
        });
    } catch (err) {
        console.error('[Token Proxy Error]', err);
        const errObj = /** @type {any} */ (err);
        
        try {
            const db = await getDb();
            const debugCol = db.collection('mcp_debug_logs');
            await debugCol.insertOne({
                timestamp: new Date(),
                method: 'POST-TOKEN-PROXY-ERROR',
                error: errObj.message || errObj.toString(),
                requestBody: rpcBody,
                headers: headersLog
            });
        } catch (dbErr) {}

        return json({ error: 'Token proxy failed', details: errObj.message }, { status: 500, headers: corsHeaders });
    }
}
