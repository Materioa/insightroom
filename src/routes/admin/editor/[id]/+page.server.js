import { error } from '@sveltejs/kit';
import { getPostsCollection } from '$lib/server/db.js';
import { ObjectId } from 'mongodb';

export const load = async ({ params }) => {
    if (params.id === 'new') {
        return { post: null };
    }

    const collection = await getPostsCollection();
    let row;
    try {
        row = await collection.findOne({ _id: new ObjectId(params.id) });
    } catch {
        throw error(400, 'Invalid Post ID');
    }
    
    if (!row) throw error(404, 'Post not found');
    
    const metadata = row.metadata || {};
    
    return {
        post: {
            ...row,
            id: row._id.toString(),
            _id: undefined,
            metadata,
            hidden: Boolean(row.hidden),
            draft: Boolean(row.draft)
        }
    };
};
