import { error } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ params, parent }) => {
    const { accessTier, token } = await parent();

    // Import dynamically
    const { getPost } = await import('$lib/server/posts.js');

    // Find the post specific to the category and slug
    const post = await getPost(params.category, params.slug);

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

    // We no longer render or return the content here to keep view-source clean.
    // The content is fetched on the client side from /api/posts/content/...

    return {
        ...post.metadata,
        title: post.title,
        date: post.date,
        excerpt: post.excerpt,
        image: post.image,
        slug: params.slug,
        category: params.category,
        isLocked,
        token,
        accessTier,
        // No 'content' returned here
    };
};
