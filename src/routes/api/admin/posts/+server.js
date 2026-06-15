import { json } from '@sveltejs/kit';
import { getPostsCollection, getDb } from '$lib/server/db.js';
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
        
        let { id, title, slug, content, metadata, saved_by_name, saved_by_display_name, saved_by_avatar } = body;
        
        if (!title) return json({ error: 'Title is required' }, { status: 400 });
        if (!slug) slug = slugify(title);

        const draft = metadata.draft ? true : false;
        const category = draft ? 'draft' : (metadata.category || '').trim();
        const categorySlug = draft ? 'draft' : slugify(category);
        metadata.category = category;
        const date = metadata.date || new Date().toISOString().split('T')[0];
        const excerpt = metadata.excerpt || '';
        const image = metadata.image || '';
        const hidden = metadata.hidden ? true : false;
        const visibility = metadata.visibility || 'public';

        const collection = await getPostsCollection();
        const db = await getDb();
        const versionsCollection = db.collection('post_versions');

        if (id && id !== 'new') {
            // Update
            const oldPost = await collection.findOne({ _id: new ObjectId(id) });
            if (oldPost) {
                // Save previous version
                await versionsCollection.insertOne({
                    post_id: oldPost._id,
                    title: oldPost.title,
                    content: oldPost.content,
                    metadata: oldPost.metadata,
                    updated_at: oldPost.updated_at || oldPost.created_at || new Date(),
                    saved_by_name: saved_by_name || metadata.author_name || 'Materio',
                    saved_by_display_name: saved_by_display_name || metadata.author_name || 'Materio',
                    saved_by_avatar: saved_by_avatar || metadata.author_avatar || '/assets/img/default-avatar.svg',
                    version_saved_at: new Date()
                });
            }

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

export async function DELETE({ request, cookies, url }) {
    // Basic auth check
    const token = cookies.get('materio_auth_token');
    if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const id = url.searchParams.get('id');
        
        if (!id) {
            return json({ error: 'Post ID is required' }, { status: 400 });
        }

        const collection = await getPostsCollection();
        const db = await getDb();
        const versionsCollection = db.collection('post_versions');

        // Delete the post
        const result = await collection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return json({ error: 'Post not found' }, { status: 404 });
        }

        // Also delete all versions of this post
        await versionsCollection.deleteMany({ post_id: new ObjectId(id) });

        return json({ success: true, message: 'Post deleted successfully' });
    } catch (/** @type {any} */ err) {
        console.error(err);
        return json({ error: err.message }, { status: 500 });
    }
}
