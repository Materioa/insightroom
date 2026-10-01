import { json } from '@sveltejs/kit';
import { getAllPosts } from '$lib/server/posts.js';
import { validateToken, getCookieToken } from '$lib/server/auth.js';
import { dev } from '$app/environment';

export const prerender = false;

const ALLOWED_ORIGINS = new Set([
    'https://room.getmaterio.app',
    'https://getmaterio.app',
    'https://accounts.getmaterio.app',
    'http://localhost:5173',
    'http://localhost:5174',
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
        // Visitor-specific: a session cookie resolves this differently per caller.
        'Cache-Control': 'private, no-store',
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

/** @type {import('./$types').RequestHandler} */
export function OPTIONS({ request }) {
    const origin = request.headers.get('origin');
    return new Response(null, {
        headers: getCorsHeaders(origin)
    });
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ request, cookies, fetch, url }) {
    const origin = request.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);

    // Get limit from query parameter
    const num = url.searchParams.get('num');
    const limit = num ? parseInt(num, 10) : null;

    // Authorization header first, shared session cookie as the browser fallback.
    const token = request.headers.get('Authorization')?.split(' ')[1] || getCookieToken(cookies);

    if (!token) {
        return json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    // Validate against Materio ID, same as every other authenticated route.
    const { user } = await validateToken(token, fetch);
    if (!user) {
        return json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const posts = await getAllPosts();
    const baseUrl = dev
        ? 'http://localhost:5173'
        : 'https://room.getmaterio.app';

    // Apply limit if specified
    let finalPosts = posts;
    if (limit && !isNaN(limit) && limit > 0) {
        finalPosts = posts.slice(0, limit);
    }

    // Map all posts (including hidden/drafts)
    const apiPosts = finalPosts.map(post => {
        const imageUrl = post.image
            ? (post.image.startsWith('http') ? post.image : `${baseUrl}${post.image}`)
            : null;

        return {
            title: post.title,
            excerpt: post.excerpt,
            date: post.date,
            category: post.category,
            categorySlug: post.categorySlug,
            imgUrl: imageUrl,
            link: post.url.startsWith('http') ? post.url : `${baseUrl}${post.url}`,
            subject: post.subject || null,
            semester: post.semester || null,
            tags: post.tags || [],
            visibility: post.visibility || null,
            hidden: post.hidden,
            draft: post.draft
        };
    });

    return json(apiPosts, {
        headers: corsHeaders
    });
}
