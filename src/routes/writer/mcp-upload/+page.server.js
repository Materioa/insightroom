import { error } from '@sveltejs/kit';
import { getPostsCollection } from '$lib/server/db.js';
import { ObjectId } from 'mongodb';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ url }) => {
    const id = url.searchParams.get('id');
    if (!id) {
        throw error(400, 'Post ID is required');
    }

    const collection = await getPostsCollection();
    let row;
    try {
        row = await collection.findOne({ _id: new ObjectId(id) });
    } catch {
        throw error(400, 'Invalid Post ID');
    }
    
    if (!row) throw error(404, 'Post not found');
    
    const metadata = row.metadata || {};
    
    return {
        post: {
            id: row._id.toString(),
            title: row.title || '',
            slug: row.slug || '',
            content: row.content || '',
            metadata,
            hidden: Boolean(row.hidden),
            draft: Boolean(row.draft)
        }
    };
};
