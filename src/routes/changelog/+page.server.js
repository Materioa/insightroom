/** @type {import('./$types').PageServerLoad} */
export const load = async () => {
  const { getAllPosts } = await import('$lib/server/posts.js');
  const allPosts = getAllPosts();

  const changelogs = allPosts
    .filter(post => {
      // @ts-ignore
      const cat = post.categorySlug;
      const cats = post.categories || post.category;

      // Check category slug or explicit list
      const isWhatsNew = cat === 'whats-new' ||
        (Array.isArray(cats) && cats.some(c => c === 'whats-new' || c === "What's New")) ||
        cats === 'whats-new' || cats === "What's New";

      return isWhatsNew;
    });

  return { changelogs };
};
