import { getAllPosts } from './src/lib/server/posts.js';
async function test() {
    const posts = await getAllPosts();
    console.log(Array.isArray(posts));
    console.log(typeof posts.filter);
}
test().catch(console.error);
