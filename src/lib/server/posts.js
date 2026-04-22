import { getPostsCollection } from './db.js';
import { ObjectId } from 'mongodb';

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
            url: `/${row.categorySlug}/${row.slug}`,
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
        url: `/${row.categorySlug}/${row.slug}`,
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
        ...metadata
    };
}

