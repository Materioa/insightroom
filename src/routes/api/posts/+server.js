import { json } from '@sveltejs/kit';
import { getAllPosts } from '$lib/server/posts.js';

export const prerender = false;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

export function OPTIONS() {
    return new Response(null, {
        headers: corsHeaders
    });
}

export function GET() {
    const posts = getAllPosts();

    // Filter and map to requested fields
    const apiPosts = posts.filter(p => !p.hidden && !p.draft).map(post => {
        return {
            title: post.title,
            excerpt: post.excerpt,
            date: post.date,
            category: post.category,
            categorySlug: post.categorySlug,
            imgUrl: `https://materioa.vercel.app${post.image}`,
            link: `https://materioa.vercel.app${post.url}`, // Absolute URL for cross-origin context
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
