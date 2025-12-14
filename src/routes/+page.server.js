/** @type {import('./$types').PageServerLoad} */
export const load = async ({ parent }) => {
    const { accessTier } = await parent();

    // Import dynamically to avoid top-level await issues if any (though standard import is fine here)
    const { getAllPosts } = await import('$lib/server/posts.js');
    const allPosts = getAllPosts();

    // Filter posts based on access tier
    const posts = allPosts.filter(post => {
        if (post.draft || post.hidden) return false;

        if (post.visibility === 'private') {
            return accessTier === 'super' || accessTier === 'plus';
        }
        return true;
    });

    // Mark which posts are visible to this user
    // We can define 'hasAccess' for client-side filtering logic if needed
    const postsWithAccess = posts.map(post => ({
        ...post,
        // We'll just pass all properties from the post object which now includes 'url'
        hasAccess: post.visibility !== 'private' || accessTier === 'super' || accessTier === 'plus'
    }));

    // Extract categories
    const categories = [...new Set(posts.flatMap(post => {
        if (!post.category && !post.categories) return [];
        const cats = post.categories || [post.category];
        return Array.isArray(cats) ? cats : [cats];
    }))].sort();

    return { posts: postsWithAccess, categories, accessTier };
};
