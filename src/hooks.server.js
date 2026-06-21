import { json } from '@sveltejs/kit';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
    const url = event.url;
    
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
            ]
        }, {
            headers: corsHeaders
        });
    }

    if (url.pathname === '/.well-known/oauth-authorization-server') {
        return json({
            issuer: url.origin,
            authorization_endpoint: `${url.origin}/authorize`,
            token_endpoint: `${url.origin}/token`,
            response_types_supported: [
                'code'
            ],
            grant_types_supported: [
                'authorization_code'
            ],
            token_endpoint_auth_methods_supported: [
                'client_secret_post',
                'client_secret_basic'
            ],
            scopes_supported: [
                'admin'
            ]
        }, {
            headers: corsHeaders
        });
    }

    return resolve(event);
}
