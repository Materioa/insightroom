import { json, error } from '@sveltejs/kit';
import { renderPostContent } from '$lib/server/renderContent.js';
import { validateToken, getCookieToken } from '$lib/server/auth.js';
import { canReadPrivate, PUBLIC_PAGE_CACHE, NO_STORE } from '$lib/server/session.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, cookies, fetch, url }) {
    // 1. Get auth token from cookies
    const token = getCookieToken(cookies);
    let accessTier = 'guest';

    // 2. Validate token and determine access tier
    if (token) {
        const authResult = await validateToken(token, fetch);
        accessTier = authResult.accessTier;
    }

    const { getPost, getPostByPermalink } = await import('$lib/server/posts.js');
    const post = params.category === '_permalink'
        ? (await getPost('', params.slug)) || (await getPostByPermalink(`/${params.slug}`))
        : await getPost(params.category, params.slug);

    if (!post) {
        throw error(404, 'Post not found');
    }

    // 3. Security Check
    if (post.visibility === 'private' && !canReadPrivate(accessTier)) {
        return json(
            { html: '<div class="locked-placeholder">Unauthorized. Please upgrade to see this content.</div>' },
            { status: 403, headers: { 'cache-control': NO_STORE } }
        );
    }

    // Public bodies are the same for everyone, so they can sit in the CDN cache
    // and pick up a CMS edit on the next revalidation.
    const isPublicPost = post.visibility !== 'private';
    const finalHtml = await renderPostContent(post.content || '');

    return json(
        { html: finalHtml },
        { headers: { 'cache-control': isPublicPost ? PUBLIC_PAGE_CACHE : NO_STORE } }
    );
}
