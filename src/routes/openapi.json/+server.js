import { json } from '@sveltejs/kit';
import openapi from '$lib/openapi.json';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'public, max-age=3600'
};

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function GET() {
    return json(openapi, {
        headers: corsHeaders
    });
}
