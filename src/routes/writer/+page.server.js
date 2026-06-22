import { getAllPosts } from '$lib/server/posts.js';

export const load = async () => {
    const allPosts = await getAllPosts();
    const posts = allPosts.map(post => {
        const { content, ...rest } = post;
        return rest;
    });
    return {
        posts
    };
};
