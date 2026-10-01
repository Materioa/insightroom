import { json } from '@sveltejs/kit';
import { AUTH_URL } from '$lib/server/auth.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

/**
 * Token proxy to Materio ID. Supports authorization_code and refresh_token grants.
 * The token `aud` is set to this MCP resource so tokens are scoped to it.
 * @type {import('@sveltejs/kit').RequestHandler}
 */
export async function POST({ request, fetch, url }) {
    const contentType = request.headers.get('content-type') || '';
    /** @type {Record<string, any>} */
    let body;
    try {
        if (contentType.includes('application/json')) body = await request.json();
        else if (contentType.includes('application/x-www-form-urlencoded')) body = Object.fromEntries(await request.formData());
        else return json({ error: 'invalid_request', error_description: 'Unsupported content type' }, { status: 400, headers: corsHeaders });
    } catch {
        return json({ error: 'invalid_request', error_description: 'Malformed body' }, { status: 400, headers: corsHeaders });
    }

    if (!body.resource) body.resource = `${url.origin}/mcp`;

    /** @type {Record<string, string>} */
    const headers = { 'Content-Type': 'application/json' };
    const authorization = request.headers.get('authorization');
    if (authorization) headers.Authorization = authorization;

    try {
        const res = await fetch(`${AUTH_URL}/api/v2/auth?action=oauth_token`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({ error: 'server_error' }));
        return json(data, {
            status: res.status,
            headers: { ...corsHeaders, 'Cache-Control': 'no-store', Pragma: 'no-cache' }
        });
    } catch (err) {
        console.error('[token proxy]', /** @type {Error} */ (err).message);
        return json({ error: 'server_error', error_description: 'Auth server unreachable' }, { status: 502, headers: corsHeaders });
    }
}
