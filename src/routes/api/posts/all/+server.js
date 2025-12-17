import { json } from '@sveltejs/kit';
import { getAllPosts } from '$lib/server/posts.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '$env/static/private';
import { dev } from '$app/environment';

export const prerender = false;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export function OPTIONS() {
    return new Response(null, {
        headers: corsHeaders
    });
}

export function GET({ request, cookies }) {
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
        jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const posts = getAllPosts();
    const baseUrl = dev 
        ? 'http://localhost:5173' 
        : 'https://insightroom.vercel.app';

    // Map all posts (including hidden/drafts)
    const apiPosts = posts.map(post => {
        return {
            title: post.title,
            excerpt: post.excerpt,
            date: post.date,
            category: post.category,
            categorySlug: post.categorySlug,
            imgUrl: post.image ? `${baseUrl}${post.image}` : null,
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
