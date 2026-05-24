import { json } from '@sveltejs/kit';
import { getPostsCollection } from '$lib/server/db.js';
import { ObjectId } from 'mongodb';

export const POST = async ({ request }) => {
    try {
        const data = await request.json();
        const { postId } = data;

        if (!postId) {
            return json({ error: 'Post ID is required' }, { status: 400 });
        }

        const collection = await getPostsCollection();
        
        const result = await collection.findOneAndUpdate(
            { _id: new ObjectId(postId) },
            { $inc: { claps: 1 } },
            { returnDocument: 'after' }
        );

        if (!result) {
            return json({ error: 'Post not found' }, { status: 404 });
        }

        return json({ success: true, claps: result.claps });
    } catch (error) {
        console.error('Failed to clap for post:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
