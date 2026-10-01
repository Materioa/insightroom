import { json } from '@sveltejs/kit';
import openapi from '$lib/openapi.json';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'public, max-age=3600'
};

/** @type {import('./$types').RequestHandler} */
export function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

/** @type {import('./$types').RequestHandler} */
export function GET() {
    // Static spec: identical for everyone, so it can be cached at the edge.
    return json(openapi, { headers: corsHeaders });
}
