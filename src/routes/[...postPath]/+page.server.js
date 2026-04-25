import { error } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ params, parent }) => {
    const { accessTier, token } = await parent();

    // Import dynamically
    const { getPost, getPostByPermalink } = await import('$lib/server/posts.js');

    const path = params.postPath;
    let post;

    // 1. Try to parse as category/slug
    const segments = path.split('/');
    if (segments.length === 2) {
        post = await getPost(segments[0], segments[1]);
    } else if (segments.length === 1) {
        post = await getPost('', segments[0]);
    }

    // 2. Fallback to permalink
    if (!post) {
        post = await getPostByPermalink('/' + path);
    }
    if (!post) {
        post = await getPostByPermalink(path);
    }

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
        slug: post.slug,
        category: post.category,
        categorySlug: post.categorySlug,
        isLocked,
        token,
        accessTier,
        // No 'content' returned here
    };
};
