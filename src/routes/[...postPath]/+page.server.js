import { error } from '@sveltejs/kit';
import { renderPostContent } from '$lib/server/renderContent.js';
import { getCookieToken, validateToken } from '$lib/server/auth.js';
import { canReadPrivate } from '$lib/server/session.js';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ params, cookies, fetch }) => {
    const { getPost, getPostByPermalink } = await import('$lib/server/posts.js');

    const path = params.postPath;
    /** @type {any} */
    let post;

    // 1. Try to parse as category/slug
    const segments = path.split('/');
    if (segments.length === 2) {
        post = await getPost(segments[0], segments[1]);
    } else if (segments.length === 1) {
        post = await getPost('', segments[0]);
    }

    // 2. Fallback to permalink
    if (!post) {
        post = await getPostByPermalink('/' + path);
    }
    if (!post) {
        post = await getPostByPermalink(path);
    }

    if (!post) {
        throw error(404, 'Post not found');
    }

    // Only gated posts need a tier. Public pages never resolve the session, so
    // the common case stays free of an auth round trip.
    let accessTier = 'guest';
    if (post.visibility === 'private') {
        const { accessTier: tier } = await validateToken(getCookieToken(cookies), fetch);
        accessTier = tier;
    }

    const isLocked = post.visibility === 'private' && !canReadPrivate(accessTier);

    // SSR content only for PUBLIC posts so that every visitor — bots, human reviewers,
    // search engines, AI assistants, AdSense — sees full content in the initial HTML.
    // Private posts always use the client-side API fetch (with skeleton loader) so their
    // content never appears in the HTML source, even for authorized users.
    //
    // That split is also what makes the page cacheable: for an anonymous visitor
    // the shell is byte-identical whoever they are, so the CDN can hold it and a
    // post republished through the CMS appears on the next revalidation rather
    // than needing a rebuild.
    const isPublicPost = post.visibility !== 'private';
    let ssrContent = '';

    if (isPublicPost) {
        try {
            ssrContent = await renderPostContent(post.content || '');
        } catch (e) {
            console.error('SSR content render failed:', e);
            // Fallback: page still loads, client-side fetch will retry
        }
    }

    return {
        ...post.metadata,
        title: post.title,
        date: post.date,
        excerpt: post.excerpt,
        image: post.image,
        slug: post.slug,
        category: post.category,
        categorySlug: post.categorySlug,
        claps: post.claps || 0,
        postId: post.id,
        isLocked,
        accessTier,
        // Pre-rendered content for all public posts; empty for locked posts
        ssrContent,
    };
};
