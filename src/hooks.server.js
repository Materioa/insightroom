import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
    const url = event.url;
    
    // Log .well-known endpoints for debugging
    if (url.pathname.startsWith('/.well-known/')) {
        try {
            const db = await getDb();
            const debugCol = db.collection('mcp_debug_logs');
            /** @type {Record<string, string>} */
            const headersObj = {};
            for (const [k, v] of event.request.headers.entries()) {
                if (k.toLowerCase() === 'authorization') {
                    headersObj[k] = v.substring(0, 15) + '...';
                } else {
                    headersObj[k] = v;
                }
            }
            await debugCol.insertOne({
                timestamp: new Date(),
                method: event.request.method,
                url: url.toString(),
                searchParams: Object.fromEntries(url.searchParams.entries()),
                headers: headersObj
            });
        } catch (e) {
            console.error('[MCP Debug Log] Failed to write well-known log:', e);
        }
    }

    // Intercept OPTIONS preflight requests for .well-known routes
    if (event.request.method === 'OPTIONS' && url.pathname.startsWith('/.well-known/')) {
        return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/.well-known/oauth-protected-resource') {
        return json({
            resource: `${url.origin}/mcp`,
            authorization_servers: [
                url.origin
            ],
            scopes_supported: [
                'admin'
            ],
            bearer_methods_supported: [
                'header'
            ],
            resource_documentation: 'https://getmaterio.app/docs/mcp'
        }, {
            headers: corsHeaders
        });
    }

    if (url.pathname === '/.well-known/oauth-authorization-server') {
        return json({
            issuer: url.origin,
            authorization_endpoint: `${url.origin}/authorize`,
            token_endpoint: `${url.origin}/token`,
            registration_endpoint: `${url.origin}/register`,
            response_types_supported: [
                'code'
            ],
            grant_types_supported: [
                'authorization_code',
                'refresh_token'
            ],
            code_challenge_methods_supported: [
                'S256'
            ],
            token_endpoint_auth_methods_supported: [
                'none',
                'client_secret_post',
                'client_secret_basic'
            ],
            scopes_supported: [
                'admin'
            ],
            client_id_metadata_document_supported: true
        }, {
            headers: corsHeaders
        });
    }

    return resolve(event);
}
