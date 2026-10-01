import { getCookieToken, validateToken } from '$lib/server/auth.js';
import { canReadPrivate } from '$lib/server/session.js';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ cookies, fetch }) => {
    const { getAllPosts } = await import('$lib/server/posts.js');
    const allPosts = await getAllPosts();

    const published = allPosts.filter((/** @type {any} */ post) => !post.draft && !post.hidden);

    // The listing is the same for everyone unless a private post is in it, so
    // only pay for the auth round trip when that is actually the case. This
    // keeps the cached homepage free of any per-visitor work.
    const hasPrivatePosts = published.some((/** @type {any} */ post) => post.visibility === 'private');

    let accessTier = 'guest';
    if (hasPrivatePosts) {
        ({ accessTier } = await validateToken(getCookieToken(cookies), fetch));
    }

    const canSee = (/** @type {any} */ post) =>
        post.visibility !== 'private' || canReadPrivate(accessTier);

    const posts = published.filter(canSee);

    // Strip the markdown body: the homepage only renders cards, and every post
    // body would otherwise be dragged over the wire on each render.
    const postsWithAccess = posts.map((/** @type {any} */ post) => {
        const { content, ...rest } = post;
        return { ...rest, hasAccess: true };
    });

    // Extract categories
    const categories = [...new Set(posts.flatMap((/** @type {any} */ post) => {
        if (!post.category && !post.categories) return [];
        const cats = post.categories || [post.category];
        return Array.isArray(cats) ? cats : [cats];
    }))].sort();

    return { posts: postsWithAccess, categories, accessTier };
};
