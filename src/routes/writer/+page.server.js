import { getAllPosts } from '$lib/server/posts.js';

export const load = async () => {
    return {
        posts: await getAllPosts()
    };
};
