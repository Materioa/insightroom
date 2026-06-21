import { json } from '@sveltejs/kit';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function GET({ url }) {
    const origin = url.origin;
    return json({
        issuer: origin,
        authorization_endpoint: `${origin}/authorize`,
        token_endpoint: `${origin}/token`,
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
