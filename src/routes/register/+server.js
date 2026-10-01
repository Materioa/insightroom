import { json } from '@sveltejs/kit';
import { AUTH_URL } from '$lib/server/auth.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

/**
 * Dynamic Client Registration (RFC 7591), proxied to Materio ID so clients are
 * registered where they're validated (redirect URIs are enforced at authorize time).
 * @type {import('@sveltejs/kit').RequestHandler}
 */
export async function POST({ request, fetch, getClientAddress }) {
    /** @type {Record<string, any>} */
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'invalid_client_metadata', error_description: 'Body must be JSON' }, { status: 400, headers: corsHeaders });
    }

    if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
        return json({
            error: 'invalid_client_metadata',
            error_description: 'redirect_uris is required and must be a non-empty array'
        }, { status: 400, headers: corsHeaders });
    }

    // Auth rate-limits registrations per IP, so forward the real client address.
    let ip = request.headers.get('x-forwarded-for') || '';
    if (!ip) {
        try { ip = getClientAddress(); } catch { /* unknown */ }
    }

    try {
        const res = await fetch(`${AUTH_URL}/api/v2/auth?action=oauth_register_app`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(ip ? { 'x-forwarded-for': ip } : {}) },
            body: JSON.stringify({ scope: 'openid profile email offline_access admin', ...body })
        });
        const data = await res.json().catch(() => ({ error: 'server_error' }));
        return json(data, { status: res.status, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error('[DCR proxy]', /** @type {Error} */ (err).message);
        return json({ error: 'server_error', error_description: 'Auth server unreachable' }, { status: 502, headers: corsHeaders });
    }
}
