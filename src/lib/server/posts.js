import { getPostsCollection } from './db.js';

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

/**
 * Shape a Mongo row into the app's post object. `metadata` is spread last so
 * custom fields (subject, semester, tags, permalink, …) stay top-level.
 *
 * @param {any} row
 * @param {{ content?: boolean }} [options] `content: false` omits the markdown
 *   body, which is what every listing endpoint needs — it keeps a page of post
 *   cards from dragging every full post body across the wire.
 */
function toPost(row, options = {}) {
    const metadata = row.metadata || {};
    const { content, ...rest } = row;

    return {
        id: row._id.toString(),
        slug: row.slug,
        categorySlug: row.categorySlug,
        date: row.date,
        url: getPostUrl(row),
        metadata,
        ...(options.content === false ? {} : { content: row.content }),
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

/** Fields every listing shares. `content` is the only heavy one. */
const LIST_PROJECTION = { content: 0 };

/**
 * All posts for listings (homepage, Writer index, changelog, public REST API).
 * Sorts newest first, matching the pre-projection behaviour.
 *
 * @param {{ content?: boolean }} [options]
 */
export async function getAllPosts(options = { content: false }) {
    const collection = await getPostsCollection();
    const rows = await collection.find({}, { projection: LIST_PROJECTION }).sort({ date: -1 }).toArray();

    return rows.map((/** @type {any} */ row) => toPost(row, options));
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

    return toPost(row);
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

    // Report the canonical URL that actually matched, not the requested form.
    const stored = row.metadata?.permalink;
    const url = typeof stored === 'string' && stored
        ? (stored.startsWith('/') ? stored : `/${stored}`)
        : permalinkWithSlash;

    return { ...toPost(row), url };
}
