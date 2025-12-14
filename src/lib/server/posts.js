
/**
 * @typedef {Object} Post
 * @property {string} slug - The title slug (e.g. 'introduction-to-android-os')
 * @property {string} categorySlug - The category slug (e.g. 'originals')
 * @property {string} date - The date string associated with the post
 * @property {string} url - The URL path to the post (e.g. '/originals/introduction-to-android-os')
 * @property {any} metadata - The frontmatter metadata
 * @property {any} content - The Svelte component content
 * @property {string} path - The file path
 * @property {boolean} hidden - Whether the post is hidden
 * @property {boolean} draft - Whether the post is a draft
 * @property {string} visibility - Visibility status (e.g., 'public', 'private')
 * @property {string|string[]} [categories] - Categories list
 * @property {string} [category] - Single category
 * @property {string} [title] - Post title
 * @property {string} [excerpt] - Post excerpt
 * @property {string} [image] - Cover image URL
 * @property {string} [subject] - Academic subject
 * @property {string} [semester] - Academic semester
 * @property {string[]} [tags] - Post tags
 */

/**
 * Slugifies a string.
 * @param {string} text 
 * @returns {string}
 */
function slugify(text) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

/**
 * Get all posts.
 * @returns {Post[]}
 */
export function getAllPosts() {
    const paths = import.meta.glob('/src/posts/*.md', { eager: true });

    return Object.entries(paths).map(([path, file]) => {
        // Extract filename parts
        const filename = path.split('/').pop()?.replace('.md', '') ?? '';

        // Parse "YYYY-MM-DD-title"
        const match = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
        let slug = filename;
        let dateFromFilename = '';

        if (match) {
            dateFromFilename = match[1];
            slug = match[2];
        }

        // @ts-ignore
        const metadata = file.metadata || {};

        // Determine category
        let category = metadata.category;
        if (!category && metadata.categories) {
            category = Array.isArray(metadata.categories) ? metadata.categories[0] : metadata.categories;
        }
        const categorySlug = slugify(category || 'uncategorized');

        // Determine URL
        const url = `/${categorySlug}/${slug}`;

        return {
            slug,
            categorySlug,
            date: metadata.date || dateFromFilename,
            url,
            // @ts-ignore
            metadata,
            // (content removed to avoid serialization error)
            path,
            hidden: metadata.hidden || false,
            draft: metadata.draft || false,
            visibility: metadata.visibility || 'public',
            category: category,
            categories: metadata.categories,
            ...metadata // Spread other props
        };
    }).sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
}

/**
 * Get a specific post by category and slug.
 * @param {string} categorySlug 
 * @param {string} slug 
 * @returns {Post | undefined}
 */
export function getPost(categorySlug, slug) {
    const posts = getAllPosts();
    return posts.find(p => p.categorySlug === categorySlug && p.slug === slug);
}
