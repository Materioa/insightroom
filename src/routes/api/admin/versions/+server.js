import { json } from '@sveltejs/kit';
import { getPostsCollection, getDb } from '$lib/server/db.js';
import { ObjectId } from 'mongodb';

export async function GET({ request, url, cookies }) {
    // Basic auth check
    const token = cookies.get('materio_auth_token');
    if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

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
