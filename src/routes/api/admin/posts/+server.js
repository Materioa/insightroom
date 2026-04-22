import { json } from '@sveltejs/kit';
import { getPostsCollection } from '$lib/server/db.js';
import { ObjectId } from 'mongodb';

/** @param {string} text */
function slugify(text) {
    if (!text) return '';
    return text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');
}

export async function POST({ request, cookies }) {
    // Basic auth check
    const token = cookies.get('materio_auth_token');
    if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        
        let { id, title, slug, content, metadata } = body;
        
        if (!title) return json({ error: 'Title is required' }, { status: 400 });
        if (!slug) slug = slugify(title);

        const category = metadata.category || '';
        const categorySlug = slugify(category || 'uncategorized');
        const date = metadata.date || new Date().toISOString().split('T')[0];
        const excerpt = metadata.excerpt || '';
        const image = metadata.image || '';
        const hidden = metadata.hidden ? true : false;
        const draft = metadata.draft ? true : false;
        const visibility = metadata.visibility || 'public';

        const collection = await getPostsCollection();

        if (id && id !== 'new') {
            // Update
            await collection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        title, slug, content, metadata,
                        category, categorySlug, date, excerpt, image, hidden, draft, visibility,
                        updated_at: new Date()
                    }
                }
            );
            return json({ success: true, id });
        } else {
            // Insert
            const result = await collection.insertOne({
                title, slug, content, metadata,
                category, categorySlug, date, excerpt, image, hidden, draft, visibility,
                created_at: new Date(),
                updated_at: new Date()
            });
            return json({ success: true, id: result.insertedId.toString() });
        }
    } catch (/** @type {any} */ err) {
        console.error(err);
        return json({ error: err.message }, { status: 500 });
    }
}
