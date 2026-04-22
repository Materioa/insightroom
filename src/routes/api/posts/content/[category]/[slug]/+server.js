import { json, error } from '@sveltejs/kit';
import { Marked } from 'marked';

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

    const { getPost } = await import('$lib/server/posts.js');
    const post = await getPost(params.category, params.slug);

    if (!post) {
        throw error(404, 'Post not found');
    }

    // 3. Security Check
    if (post.visibility === 'private' && accessTier !== 'super' && accessTier !== 'plus') {
        return json({ html: '<div class="locked-placeholder">Unauthorized. Please upgrade to see this content.</div>' }, { status: 403 });
    }

    // Create a new Marked instance for this request
    const customMarked = new Marked({
        gfm: true,
        breaks: true,
        renderer: {
            // ... (keep the text renderer logic)
            /** @param {any} token */
            text(token) {
                let text = typeof token === 'string' ? token : token.text;
                
                // Attachment replacement
                const attachmentRegex = /\[attachment:([\s\S]+?):([\s\S]+?)\]/g;
                let newText = text.replace(attachmentRegex, (/** @type {string} */ match, /** @type {string} */ url, /** @type {string} */ title) => {
                    const cleanUrl = url.trim();
                    const cleanTitle = title.trim();
                    const fileExt = cleanUrl.split('.').pop()?.toUpperCase() || 'FILE';
                    const id = 'attachment-' + Math.random().toString(36).substr(2, 5);
                    
                    return `<div class="attachment-card" data-file-path="${cleanUrl}" data-attachment-id="${id}" onclick="window.open('${cleanUrl}', '_blank')">
                        <div class="attachment-details">
                            <div class="attachment-title">${cleanTitle}</div>
                            <div class="attachment-meta"><span class="file-type">${fileExt}</span> • <span class="file-size">Click to view</span></div>
                        </div>
                        <div class="attachment-preview">
                            <canvas id="canvas-${id}" width="100" height="130"></canvas>
                            <img id="img-${id}" style="display: none;" alt="" />
                        </div>
                    </div>`;
                });

                // Video replacement
                const videoRegex = /\[video:([\s\S]+?)\]/g;
                newText = newText.replace(videoRegex, (/** @type {string} */ match, /** @type {string} */ vparams) => {
                    const parts = vparams.split(':');
                    const videoUrl = parts[0].trim();
                    const isCover = parts[1]?.trim() === 'cover';
                    const id = 'video-' + Math.random().toString(36).substr(2, 5);
                    
                    if (isCover) {
                        return `<div class="video-cover"><video id="${id}" muted loop autoplay playsinline src="${videoUrl}"></video><div class="video-controls playing" onclick="window.toggleVideo('${id}')"><i class="fa-solid fa-pause"></i></div></div>`;
                    }
                    return `<div class="video-embed"><video id="${id}" muted loop autoplay playsinline src="${videoUrl}"></video><div class="video-controls playing" onclick="window.toggleVideo('${id}')"><i class="fa-solid fa-pause"></i></div></div>`;
                });

                return newText;
            }
        }
    });

    const html = customMarked.parse(post.content || '');

    return json({ html });
}
