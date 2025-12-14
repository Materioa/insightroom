import { error } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ params, parent }) => {
    const { accessTier } = await parent();

    // Import dynamically
    const { getPost, getAllPosts } = await import('$lib/server/posts.js');

    // Find the post specific to the category and slug
    const post = getPost(params.category, params.slug);

    if (!post) {
        throw error(404, 'Post not found');
    }

    // Check access for private posts
    let isLocked = false;
    if (post.visibility === 'private') {
        if (accessTier !== 'super' && accessTier !== 'plus') {
            isLocked = true;
        }
    }

    // Get previous/next posts logic
    // We strictly use frontmatter 'next_post' and 'previous_post' if defined.
    // Auto-calculation has been removed as per requirements.

    return {
        // @ts-ignore
        ...post.metadata,
        slug: params.slug,
        category: params.category, // Pass category param to page if needed
        isLocked // Pass lock status to UI
    };
};
