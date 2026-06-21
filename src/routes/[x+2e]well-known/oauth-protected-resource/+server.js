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
        resource: `${origin}/mcp`,
        authorization_servers: [
            origin
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
