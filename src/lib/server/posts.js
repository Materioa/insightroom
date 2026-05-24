import { getPostsCollection } from './db.js';
import { ObjectId } from 'mongodb';

/** @param {any} row */
function getPostUrl(row) {
    const metadata = row.metadata || {};
    if (metadata.permalink) {
        // Resolve any unresolved template placeholders in the permalink
        let permalink = metadata.permalink;
        permalink = permalink.replace(/:slug/gi, row.slug || '');
        permalink = permalink.replace(/:title/gi, row.slug || '');
        permalink = permalink.replace(/:category/gi, row.categorySlug || '');
        // Clean up any double slashes that might result from empty replacements
        permalink = permalink.replace(/\/\/+/g, '/');
        return permalink.startsWith('/') ? permalink : `/${permalink}`;
    }
    return row.categorySlug ? `/${row.categorySlug}/${row.slug}` : `/${row.slug}`;
}

export async function getAllPosts() {
    const collection = await getPostsCollection();
    const rows = await collection.find({}).sort({ date: -1 }).toArray();
    
    return rows.map((/** @type {any} */ row) => {
        const metadata = row.metadata || {};
        
        return {
            id: row._id.toString(),
            slug: row.slug,
            categorySlug: row.categorySlug,
            date: row.date,
            url: getPostUrl(row),
            metadata,
            content: row.content,
            hidden: Boolean(row.hidden),
            draft: Boolean(row.draft),
            visibility: row.visibility,
            category: row.category,
            categories: metadata.categories,
            title: row.title,
            excerpt: row.excerpt,
            image: row.image,
            claps: row.claps || 0,
            ...metadata
        };
    });
}

/**
 * @param {string} categorySlug
 * @param {string} slug
 */
export async function getPost(categorySlug, slug) {
    /** @param {string} text */
    function slugify(text) {
        if (!text) return '';
        return text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');
    }
    const normalizedCategory = slugify(categorySlug);
    
    const collection = await getPostsCollection();
    const row = await collection.findOne({ categorySlug: normalizedCategory, slug });
    
    if (!row) return undefined;
    
    const metadata = row.metadata || {};
    
    return {
        id: row._id.toString(),
        slug: row.slug,
        categorySlug: row.categorySlug,
        date: row.date,
        url: getPostUrl(row),
        metadata,
        content: row.content,
        hidden: Boolean(row.hidden),
        draft: Boolean(row.draft),
        visibility: row.visibility,
        category: row.category,
        categories: metadata.categories,
        title: row.title,
        excerpt: row.excerpt,
        image: row.image,
        claps: row.claps || 0,
        ...metadata
    };
}

/**
 * @param {string} permalink
 */
export async function getPostByPermalink(permalink) {
    const collection = await getPostsCollection();
    const permalinkNoSlash = permalink.replace(/^\/+/, '');
    const permalinkWithSlash = '/' + permalinkNoSlash;
    
    const row = await collection.findOne({
        $or: [
            { "metadata.permalink": permalink },
            { "metadata.permalink": permalinkNoSlash },
            { "metadata.permalink": permalinkWithSlash }
        ]
    });
    
    if (!row) return undefined;
    
    const metadata = row.metadata || {};
    
    return {
        id: row._id.toString(),
        slug: row.slug,
        categorySlug: row.categorySlug,
        date: row.date,
        url: permalinkWithSlash,
        metadata,
        content: row.content,
        hidden: Boolean(row.hidden),
        draft: Boolean(row.draft),
        visibility: row.visibility,
        category: row.category,
        categories: metadata.categories,
        title: row.title,
        excerpt: row.excerpt,
        image: row.image,
        claps: row.claps || 0,
        ...metadata
    };
}
