import { json } from '@sveltejs/kit';
import { validateToken } from '$lib/server/auth.js';
import { styleGuidelines } from '$lib/server/guidelines.js';

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function POST({ request, cookies, fetch, url }) {
    // Basic auth check supporting both Cookies and Bearer tokens
    let token = cookies.get('materio_auth_token');
    const authHeader = request.headers.get('Authorization');
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }
    if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

    const { user, accessTier } = await validateToken(token, fetch, url);
    if (!user || accessTier !== 'super') {
        return json({ error: 'Unauthorized: Admin privileges required' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { topic } = body;

        if (!topic) {
            return json({ error: 'Topic is required' }, { status: 400 });
        }

        return json({
            success: true,
            outline: `Guidelines retrieved successfully for topic: "${topic}".\n\n${styleGuidelines}`
        });
    } catch (/** @type {any} */ err) {
        console.error(err);
        return json({ error: err.message }, { status: 500 });
    }
}
