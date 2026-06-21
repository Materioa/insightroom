import { json } from '@sveltejs/kit';
import { getPostsCollection, getDb } from '$lib/server/db.js';
import { ObjectId } from 'mongodb';
import { validateToken } from '$lib/server/auth.js';

export async function GET({ request, url, cookies, fetch }) {
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
        const id = url.searchParams.get('id');
        if (!id) return json({ error: 'Post ID is required' }, { status: 400 });

        const db = await getDb();
        const versionsCollection = db.collection('post_versions');

        const versions = await versionsCollection
            .find({ post_id: new ObjectId(id) })
            .sort({ version_saved_at: -1 })
            .limit(20)
            .toArray();

        return json({ success: true, versions });
    } catch (/** @type {any} */ err) {
        console.error(err);
        return json({ error: err.message }, { status: 500 });
    }
}
