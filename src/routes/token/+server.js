import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

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
    try {
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

        const headers = new Headers();
        headers.set('Content-Type', 'application/json');
        const authHeader = request.headers.get('authorization');
        if (authHeader) {
            headers.set('Authorization', authHeader);
        }

        const authBaseUrl = env.AUTH_URL || 'https://getmaterio.app';
        const res = await fetch(`${authBaseUrl}/api/v2/auth?action=oauth_token`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        const data = await res.json();
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
        return json({ error: 'Token proxy failed' }, { status: 500, headers: corsHeaders });
    }
}
