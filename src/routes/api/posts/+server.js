import { json } from '@sveltejs/kit';
import { getAllPosts } from '$lib/server/posts.js';

export const prerender = false;

const ALLOWED_ORIGINS = new Set([
    'https://materioa.vercel.app',
    'https://getmaterio.app',
    'https://room.getmaterio.app',
    'http://localhost:5173',
    'http://localhost:1000'
]);

/**
 * @param {string | null} origin
 */
function getCorsHeaders(origin) {
    /** @type {Record<string, string>} */
    const headers = {
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        Vary: 'Origin'
    };

    if (origin && ALLOWED_ORIGINS.has(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
    } else {
        headers['Access-Control-Allow-Origin'] = '*';
    }

    return headers;
}

/** @type {import('@sveltejs/kit').RequestHandler} */
export function OPTIONS({ request }) {
    const origin = request.headers.get('origin');
    return new Response(null, {
        headers: getCorsHeaders(origin)
    });
}

export async function GET({ request, url }) {
    const origin = request.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);

    // Get limit and filters from query parameters
    const num = url.searchParams.get('num');
    const limit = num ? parseInt(num, 10) : null;
    const subject = url.searchParams.get('subject');
    const semester = url.searchParams.get('semester');

    const posts = await getAllPosts();
    const baseUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:5173' 
        : 'https://room.getmaterio.app';

    // Filter and map to requested fields
    let filteredPosts = posts.filter((/** @type {any} */ p) => !p.hidden && !p.draft);

    // Apply filters if specified
    if (subject) {
        filteredPosts = filteredPosts.filter((/** @type {any} */ p) => p.subject === subject);
    }

    if (semester) {
        filteredPosts = filteredPosts.filter((/** @type {any} */ p) => p.semester === semester);
    }

    // Apply limit if specified
    if (limit && !isNaN(limit) && limit > 0) {
        filteredPosts = filteredPosts.slice(0, limit);
    }

    const apiPosts = filteredPosts.map((/** @type {any} */ post) => {
        return {
            title: post.title,
            excerpt: post.excerpt,
            date: post.date,
            category: post.category,
            categorySlug: post.categorySlug,
            imgUrl: post.image ? (post.image.startsWith('http') ? post.image : `${baseUrl}${post.image}`) : null,
            link: post.url.startsWith('http') ? post.url : `${baseUrl}${post.url}`, // Absolute URL for cross-origin context
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
