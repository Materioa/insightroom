import { json } from '@sveltejs/kit';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

const cacheHeaders = { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' };

// Scopes advertised by Materio ID. `admin` is what grants access to this MCP server.
const SCOPES = ['openid', 'profile', 'email', 'offline_access', 'admin'];

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
    const { pathname, origin } = event.url;

    if (!pathname.startsWith('/.well-known/')) return resolve(event);

    if (event.request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    // RFC 9728: protected resource metadata for the MCP endpoint.
    if (pathname === '/.well-known/oauth-protected-resource' || pathname === '/.well-known/oauth-protected-resource/mcp') {
        return json({
            resource: `${origin}/mcp`,
            authorization_servers: [origin],
            scopes_supported: ['admin'],
            bearer_methods_supported: ['header'],
            resource_documentation: 'https://getmaterio.app/docs/mcp'
        }, { headers: cacheHeaders });
    }

    // RFC 8414: this origin fronts Materio ID (auth.getmaterio.app). Some MCP
    // clients require the authorization server to share the resource's origin,
    // so /authorize, /token and /register are thin proxies to Materio ID.
    if (pathname === '/.well-known/oauth-authorization-server' || pathname === '/.well-known/oauth-authorization-server/mcp') {
        return json({
            issuer: origin,
            authorization_endpoint: `${origin}/authorize`,
            token_endpoint: `${origin}/token`,
            registration_endpoint: `${origin}/register`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            code_challenge_methods_supported: ['S256'],
            token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
            scopes_supported: SCOPES,
            client_id_metadata_document_supported: true
        }, { headers: cacheHeaders });
    }

    return resolve(event);
}
