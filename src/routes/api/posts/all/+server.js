import { json } from '@sveltejs/kit';
import { getAllPosts } from '$lib/server/posts.js';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

export const prerender = false;

/**
 * @param {string | null} origin
 */
function getCorsHeaders(origin) {
    /** @type {Record<string, string>} */
    const headers = {
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (origin) {
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

/** @type {import('@sveltejs/kit').RequestHandler} */
export function GET({ request, cookies }) {
    const origin = request.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);

    // 1. Try Authorization header
    let token = request.headers.get('Authorization')?.split(' ')[1];

    // 2. Fallback to 'materio_auth_token' cookie if header is missing
    if (!token) {
        token = cookies.get('materio_auth_token');
    }

    if (!token) {
        return json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    try {
        // Use env variable or fallback since "no env in play"
        const secret = env.JWT_SECRET || 'secret';
        jwt.verify(token, secret);
    } catch (err) {
        return json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const posts = getAllPosts();
    const baseUrl = dev
        ? 'http://localhost:5173'
        : 'https://insightroom.vercel.app';

    // Map all posts (including hidden/drafts)
    const apiPosts = posts.map(post => {
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
            link: `${baseUrl}${post.url}`,
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
