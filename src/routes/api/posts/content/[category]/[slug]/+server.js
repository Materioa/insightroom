import { json, error } from '@sveltejs/kit';
import { renderPostContent } from '$lib/server/renderContent.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, cookies, fetch, url }) {
    // 1. Get auth token from cookies
    const token = cookies.get('materio_auth_token');
    let accessTier = 'guest';

    // 2. Validate token and determine access tier
    if (token) {
        const isDevHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
        const authBaseUrls = isDevHost
            ? ['http://localhost:1000', 'https://materioa.vercel.app']
            : ['https://materioa.vercel.app'];

        for (const authBaseUrl of authBaseUrls) {
            try {
                const response = await fetch(`${authBaseUrl}/api/v2/profile`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const userData = await response.json();
                    const user = userData.user || userData;
                    if (user?.hasAdminPrivileges) accessTier = 'super';
                    else if (user?.isPlusUser) accessTier = 'plus';
                    else accessTier = 'normal';
                    break;
                }
            } catch (e) { /* ignore and try next auth host */ }
        }
    }

    const { getPost, getPostByPermalink } = await import('$lib/server/posts.js');
    const post = params.category === '_permalink'
        ? (await getPost('', params.slug)) || (await getPostByPermalink(`/${params.slug}`))
        : await getPost(params.category, params.slug);

    if (!post) {
        throw error(404, 'Post not found');
    }

    // 3. Security Check
    if (post.visibility === 'private' && accessTier !== 'super' && accessTier !== 'plus') {
        return json({ html: '<div class="locked-placeholder">Unauthorized. Please upgrade to see this content.</div>' }, { status: 403 });
    }

    // Use shared renderer
    const finalHtml = await renderPostContent(post.content || '');

    return json({ html: finalHtml });
}
