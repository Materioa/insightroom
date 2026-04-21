import { json } from '@sveltejs/kit';
import { getAllPosts } from '$lib/server/posts.js';

export const prerender = false;

const ALLOWED_ORIGINS = new Set([
    'https://materioa.vercel.app',
    'https://room.getmaterio.app',
    'http://localhost:5173',
    'http://localhost:1000'
]);

/**
 * @param {string | null} origin
 */
function getCorsHeaders(origin) {
    const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : '*';

    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin'
    };
}

/** @type {import('@sveltejs/kit').RequestHandler} */
export function OPTIONS({ request }) {
    const origin = request.headers.get('origin');
    return new Response(null, {
        headers: getCorsHeaders(origin)
    });
}

/** @type {import('@sveltejs/kit').RequestHandler} */
export function GET({ request }) {
    const origin = request.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);
    const posts = getAllPosts();
    const baseUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:5173' 
        : 'https://room.getmaterio.app';

    // Filter and map to requested fields
    const apiPosts = posts.filter(p => !p.hidden && !p.draft).map(post => {
        return {
            title: post.title,
            excerpt: post.excerpt,
            date: post.date,
            category: post.category,
            categorySlug: post.categorySlug,
            imgUrl: post.image ? `${baseUrl}${post.image}` : null,
            link: `${baseUrl}${post.url}`, // Absolute URL for cross-origin context
            subject: post.subject || null,
            semester: post.semester || null,
            tags: post.tags || [],
            visibility: post.visibility || null,

        };
    });

    return json(apiPosts, {
        headers: corsHeaders
    });
}
