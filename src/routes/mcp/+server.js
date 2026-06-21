import { json } from '@sveltejs/kit';
import { validateToken } from '$lib/server/auth.js';
import { getPostsCollection, getDb } from '$lib/server/db.js';
import { getAllPosts, getPost, getPostByPermalink } from '$lib/server/posts.js';
import { ObjectId } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '$env/dynamic/private';
import crypto from 'crypto';

// In-memory registry of active SSE streams (for environments where processes persist)
/** @type {Map<string, ReadableStreamDefaultController>} */
const activeSessions = new Map();

// Helper to send JSON-RPC event to SSE stream
/**
 * @param {string} sessionId
 * @param {any} message
 */
function sendSseMessage(sessionId, message) {
    const controller = activeSessions.get(sessionId);
    if (controller) {
        try {
            const data = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
            return true;
        } catch (err) {
            console.error(`[MCP SSE] Failed to write to session ${sessionId}:`, err);
            activeSessions.delete(sessionId);
        }
    }
    return false;
}

/** @param {string} text */
function slugify(text) {
    if (!text) return '';
    return text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');
}
/**
 * Maps a given name to a domain or parses it if it looks like a domain,
 * returning the Google S2 favicon URL.
 * @param {string | undefined} name
 * @param {string | undefined} explicitAvatar
 * @returns {string | undefined}
 */
function resolveAvatar(name, explicitAvatar) {
    if (explicitAvatar) return explicitAvatar;
    if (!name) return undefined;

    const trimmed = name.trim().toLowerCase();
    
    // Map common AI/service names to their domains
    let domain = '';
    if (trimmed === 'claude' || trimmed === 'claude.ai') {
        domain = 'claude.ai';
    } else if (trimmed === 'chatgpt' || trimmed === 'chatgpt.com' || trimmed === 'openai') {
        domain = 'openai.com';
    } else if (trimmed === 'gemini' || trimmed === 'gemini.google.com') {
        domain = 'gemini.google.com';
    } else if (trimmed === 'deepseek' || trimmed === 'deepseek.com') {
        domain = 'deepseek.com';
    } else if (trimmed.includes('.')) {
        domain = trimmed;
    }

    if (domain) {
        return `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
    }

    return undefined;
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ request, url, fetch }) {
    // 1. Get Token from Header or Query Param
    const authHeader = request.headers.get('Authorization');
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        token = url.searchParams.get('token') || '';
    }

    if (!token) {
        return new Response('Unauthorized: Missing Token', { status: 401 });
    }

    // 2. Validate Token and Access Tier (Must be super user / admin)
    const { user, accessTier } = await validateToken(token, fetch, url);
    if (!user || accessTier !== 'super') {
        return new Response('Unauthorized: Admin access required', { status: 403 });
    }

    // 3. Setup SSE Stream
    const sessionId = crypto.randomUUID();
    const stream = new ReadableStream({
        start(controller) {
            activeSessions.set(sessionId, controller);

            // Send initial endpoint message to let the client know where to send POST messages
            const endpointUri = `${url.pathname}?sessionId=${sessionId}&token=${encodeURIComponent(token)}`;
            const initEvent = `event: endpoint\ndata: ${endpointUri}\n\n`;
            controller.enqueue(new TextEncoder().encode(initEvent));

            // Setup keep-alive ping
            const interval = setInterval(() => {
                try {
                    controller.enqueue(new TextEncoder().encode(': ping\n\n'));
                } catch {
                    clearInterval(interval);
                    activeSessions.delete(sessionId);
                }
            }, 30000);
        },
        cancel() {
            activeSessions.delete(sessionId);
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, url, fetch }) {
    // 1. Get Token and Authenticate
    const authHeader = request.headers.get('Authorization');
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        token = url.searchParams.get('token') || '';
    }

    if (!token) {
        return json({ error: 'Unauthorized: Missing Token' }, { status: 401 });
    }

    const { user, accessTier } = await validateToken(token, fetch, url);
    if (!user || accessTier !== 'super') {
        return json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    // 2. Parse JSON-RPC message
    let body;
    try {
        body = await request.json();
    } catch (err) {
        return json({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null }, { status: 400 });
    }

    const { jsonrpc, id, method, params } = body;
    if (jsonrpc !== '2.0' || !method) {
        return json({ jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: id || null }, { status: 400 });
    }

    const sessionId = url.searchParams.get('sessionId') || '';

    // 3. Process Method
    let result = null;
    let error = null;

    try {
        switch (method) {
            case 'initialize':
                result = {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: {}
                    },
                    serverInfo: {
                        name: 'insightroom-mcp-server',
                        version: '1.0.0'
                    }
                };
                break;

            case 'tools/list':
                result = {
                    tools: [
                        {
                            name: 'list_posts',
                            description: 'Retrieve a list of all posts in the insightroom database with their metadata.',
                            inputSchema: {
                                type: 'object',
                                properties: {}
                            }
                        },
                        {
                            name: 'get_post',
                            description: 'Fetch the full details of a specific post by its ID, slug, or permalink.',
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', description: 'The unique MongoDB ObjectId of the post.' },
                                    slug: { type: 'string', description: 'The post slug.' },
                                    categorySlug: { type: 'string', description: 'The slug of the post category.' },
                                    permalink: { type: 'string', description: 'The custom permalink URL.' }
                                }
                            }
                        },
                        {
                            name: 'create_post',
                            description: 'Create a new post in the insightroom database.',
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    title: { type: 'string', description: 'The title of the post.' },
                                    slug: { type: 'string', description: 'Custom slug. If not provided, it will be automatically generated from the title.' },
                                    content: { type: 'string', description: 'The content/body of the post (Markdown format).' },
                                    metadata: {
                                        type: 'object',
                                        description: 'Key-value metadata such as categories, tags, excerpt, date, author details, image, or custom fields.',
                                        properties: {
                                            excerpt: { type: 'string' },
                                            date: { type: 'string', description: 'Format YYYY-MM-DD' },
                                            category: { type: 'string' },
                                            visibility: { type: 'string', enum: ['public', 'private'] },
                                            draft: { type: 'boolean' },
                                            hidden: { type: 'boolean' },
                                            image: { type: 'string', description: 'Cover image URL.' },
                                            author_name: { type: 'string', description: "The name of the author. E.g. 'claude.ai'." },
                                            author_avatar: { type: 'string', description: "The avatar URL of the author. If representing an AI, you can use the Google S2 favicon service: 'https://www.google.com/s2/favicons?sz=128&domain=claude.ai'." }
                                        }
                                    }
                                },
                                required: ['title']
                            }
                        },
                        {
                            name: 'update_post',
                            description: 'Update an existing post details, content, or metadata.',
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', description: 'The unique MongoDB ObjectId of the post to update.' },
                                    title: { type: 'string' },
                                    slug: { type: 'string' },
                                    content: { type: 'string' },
                                    metadata: {
                                        type: 'object',
                                        description: 'Updated metadata properties including optional author_name or author_avatar.',
                                        properties: {
                                            excerpt: { type: 'string' },
                                            date: { type: 'string' },
                                            category: { type: 'string' },
                                            visibility: { type: 'string' },
                                            draft: { type: 'boolean' },
                                            hidden: { type: 'boolean' },
                                            image: { type: 'string' },
                                            author_name: { type: 'string' },
                                            author_avatar: { type: 'string' }
                                        }
                                    },
                                    saved_by_name: { type: 'string', description: "The identifier of the editor performing this update (e.g. 'claude.ai'). If a domain is provided, the avatar is auto-generated via Google S2 favicon service." },
                                    saved_by_display_name: { type: 'string', description: "The display name of the editor (e.g. 'Claude')." },
                                    saved_by_avatar: { type: 'string', description: "Explicit avatar URL of the editor." }
                                },
                                required: ['id']
                            }
                        },
                        {
                            name: 'delete_post',
                            description: 'Permanently delete a post and its revision/version history.',
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', description: 'The unique MongoDB ObjectId of the post to delete.' }
                                },
                                required: ['id']
                            }
                        },
                        {
                            name: 'upload_image',
                            description: 'Upload an image from a base64 encoded string or external public URL to Cloudinary (or local upload fallback) and return the secure asset URL.',
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    image: { type: 'string', description: 'The base64 encoded data URI (e.g. data:image/png;base64,...) or a public HTTP/HTTPS URL.' },
                                    filename: { type: 'string', description: 'The preferred file name (optional).' }
                                },
                                required: ['image']
                            }
                        }
                    ]
                };
                break;

            case 'tools/call': {
                const { name, arguments: args } = params;
                result = await handleToolCall(name, args, user);
                break;
            }

            default:
                error = { code: -32601, message: `Method not found: ${method}` };
        }
    } catch (/** @type {any} */ err) {
        console.error(`[MCP JSON-RPC] Error processing method ${method}:`, err);
        error = { code: -32603, message: err.message || 'Internal error' };
    }

    /** @type {{ jsonrpc: string, id: any, error?: any, result?: any }} */
    const responsePayload = { jsonrpc: '2.0', id };
    if (error) {
        responsePayload.error = error;
    } else {
        responsePayload.result = result;
    }

    // 4. Return response:
    // If sessionId is active and in our registry, send via SSE stream (legacy spec)
    // AND always return the response directly in the POST body (robust, serverless-friendly, Streamable HTTP compliant)
    if (sessionId) {
        sendSseMessage(sessionId, responsePayload);
    }

    return json(responsePayload);
}

/**
 * Core handler to process MCP Tool calls
 * @param {string} name
 * @param {any} args
 * @param {any} currentUser
 */
async function handleToolCall(name, args, currentUser) {
    const collection = await getPostsCollection();
    const db = await getDb();

    switch (name) {
        case 'list_posts': {
            const posts = await getAllPosts();
            const postsWithoutContent = posts.map(post => {
                const { content, ...rest } = post;
                return rest;
            });
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(postsWithoutContent, null, 2)
                    }
                ]
            };
        }

        case 'get_post': {
            const { id, slug, categorySlug, permalink } = args;
            let post;

            if (id) {
                const row = await collection.findOne({ _id: new ObjectId(id) });
                if (row) {
                    post = {
                        id: row._id.toString(),
                        slug: row.slug,
                        categorySlug: row.categorySlug,
                        date: row.date,
                        content: row.content,
                        hidden: Boolean(row.hidden),
                        draft: Boolean(row.draft),
                        visibility: row.visibility,
                        category: row.category,
                        title: row.title,
                        excerpt: row.excerpt,
                        image: row.image,
                        metadata: row.metadata || {}
                    };
                }
            } else if (permalink) {
                post = await getPostByPermalink(permalink);
            } else if (slug && categorySlug) {
                post = await getPost(categorySlug, slug);
            }

            if (!post) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: 'Post not found.' }]
                };
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(post, null, 2)
                    }
                ]
            };
        }

        case 'create_post': {
            let { title, slug, content, metadata } = args;
            if (!title) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: 'Title is required.' }]
                };
            }

            if (!slug) slug = slugify(title);
            metadata = metadata || {};

            // Automatically resolve author avatar
            const avatar = resolveAvatar(metadata.author_name, metadata.author_avatar);
            if (avatar) {
                metadata.author_avatar = avatar;
            }

            const draft = metadata.draft ? true : false;
            const category = draft ? 'draft' : (metadata.category || '').trim();
            const categorySlug = draft ? 'draft' : slugify(category);
            metadata.category = category;
            const date = metadata.date || new Date().toISOString().split('T')[0];
            const excerpt = metadata.excerpt || '';
            const image = metadata.image || '';
            const hidden = metadata.hidden ? true : false;
            const visibility = metadata.visibility || 'public';

            const result = await collection.insertOne({
                title, slug, content, metadata,
                category, categorySlug, date, excerpt, image, hidden, draft, visibility,
                created_at: new Date(),
                updated_at: new Date()
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Successfully created post "${title}" with ID: ${result.insertedId.toString()}`
                    }
                ]
            };
        }

        case 'update_post': {
            const { id, title, slug, content, metadata, saved_by_name, saved_by_display_name, saved_by_avatar } = args;
            if (!id) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: 'Post ID is required for updates.' }]
                };
            }

            const oldPost = await collection.findOne({ _id: new ObjectId(id) });
            if (!oldPost) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: 'Post not found.' }]
                };
            }

            // Resolve editor avatar
            const resolvedAvatar = resolveAvatar(saved_by_name, saved_by_avatar);

            // Save previous version in version history
            const versionsCollection = db.collection('post_versions');
            await versionsCollection.insertOne({
                post_id: oldPost._id,
                title: oldPost.title,
                content: oldPost.content,
                metadata: oldPost.metadata || {},
                updated_at: oldPost.updated_at || oldPost.created_at || new Date(),
                saved_by_name: saved_by_name || currentUser.username || 'MCP Server',
                saved_by_display_name: saved_by_display_name || currentUser.name || 'MCP Server',
                saved_by_avatar: resolvedAvatar || currentUser.avatar || '/assets/img/default-avatar.svg',
                version_saved_at: new Date()
            });

            // Prepare update object
            /** @type {Record<string, any>} */
            const updateDoc = {};
            if (title !== undefined) updateDoc.title = title;
            if (slug !== undefined) updateDoc.slug = slugify(slug);
            if (content !== undefined) updateDoc.content = content;

            // Merge metadata properties if metadata is provided
            if (metadata !== undefined) {
                // Automatically resolve author avatar
                const authorAvatar = resolveAvatar(metadata.author_name, metadata.author_avatar);
                if (authorAvatar) {
                    metadata.author_avatar = authorAvatar;
                }
                const newMetadata = { ...(oldPost.metadata || {}), ...metadata };
                updateDoc.metadata = newMetadata;
                if (newMetadata.excerpt !== undefined) updateDoc.excerpt = newMetadata.excerpt;
                if (newMetadata.image !== undefined) updateDoc.image = newMetadata.image;
                if (newMetadata.date !== undefined) updateDoc.date = newMetadata.date;
                if (newMetadata.visibility !== undefined) updateDoc.visibility = newMetadata.visibility;
                if (newMetadata.draft !== undefined) {
                    updateDoc.draft = Boolean(newMetadata.draft);
                    updateDoc.category = updateDoc.draft ? 'draft' : (newMetadata.category || oldPost.category || '').trim();
                    updateDoc.categorySlug = updateDoc.draft ? 'draft' : slugify(updateDoc.category);
                    updateDoc.metadata.category = updateDoc.category;
                }
                if (newMetadata.hidden !== undefined) updateDoc.hidden = Boolean(newMetadata.hidden);
            }

            updateDoc.updated_at = new Date();

            await collection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updateDoc }
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: `Successfully updated post "${title || oldPost.title}" (ID: ${id})`
                    }
                ]
            };
        }

        case 'delete_post': {
            const { id } = args;
            if (!id) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: 'Post ID is required.' }]
                };
            }

            const result = await collection.deleteOne({ _id: new ObjectId(id) });
            if (result.deletedCount === 0) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: 'Post not found.' }]
                };
            }

            // Also delete version history
            const versionsCollection = db.collection('post_versions');
            await versionsCollection.deleteMany({ post_id: new ObjectId(id) });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Successfully deleted post ID: ${id} and its revision history.`
                    }
                ]
            };
        }

        case 'upload_image': {
            const { image, filename } = args;
            if (!image) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: 'Image base64 or URL is required.' }]
                };
            }

            let buffer;
            let fileType = 'image/png';

            if (image.startsWith('data:')) {
                // Parse base64 data URI
                const match = image.match(/^data:([^;]+);base64,(.+)$/);
                if (!match) {
                    return {
                        isError: true,
                        content: [{ type: 'text', text: 'Invalid base64 image data URI format.' }]
                    };
                }
                fileType = match[1];
                buffer = Buffer.from(match[2], 'base64');
            } else if (image.startsWith('http://') || image.startsWith('https://')) {
                // Fetch external image
                try {
                    const imgRes = await globalThis.fetch(image);
                    if (!imgRes.ok) throw new Error(`Status ${imgRes.status}`);
                    fileType = imgRes.headers.get('Content-Type') || 'image/png';
                    const arrayBuffer = await imgRes.arrayBuffer();
                    buffer = Buffer.from(arrayBuffer);
                } catch (/** @type {any} */ fetchErr) {
                    return {
                        isError: true,
                        content: [{ type: 'text', text: `Failed to fetch external image URL: ${fetchErr.message}` }]
                    };
                }
            } else {
                // Raw base64 string
                buffer = Buffer.from(image, 'base64');
            }

            // Upload via Cloudinary
            if (env.CLOUDINARY_URL || (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)) {
                cloudinary.config({
                    cloud_name: env.CLOUDINARY_CLOUD_NAME,
                    api_key: env.CLOUDINARY_API_KEY,
                    api_secret: env.CLOUDINARY_API_SECRET
                });

                try {
                    const uploadResult = await new Promise((resolve, reject) => {
                        const uploadStream = cloudinary.uploader.upload_stream(
                            { folder: 'insightroom', resource_type: 'image' },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result);
                            }
                        );
                        uploadStream.end(buffer);
                    });
                    // @ts-ignore
                    return {
                        content: [
                            {
                                type: 'text',
                                // @ts-ignore
                                text: JSON.stringify({ success: true, url: uploadResult.secure_url }, null, 2)
                            }
                        ]
                    };
                } catch (/** @type {any} */ cloudinaryErr) {
                    console.error('[MCP Upload] Cloudinary error:', cloudinaryErr);
                    return {
                        isError: true,
                        content: [{ type: 'text', text: `Cloudinary upload failed: ${cloudinaryErr.message}` }]
                    };
                }
            } else {
                // Fallback to local upload inside static/uploads
                try {
                    const ext = fileType.split('/').pop() || 'png';
                    const namePart = filename ? slugify(filename.split('.')[0]) : `${Date.now()}-${Math.round(Math.random() * 1000)}`;
                    const finalFilename = `${namePart}.${ext}`;
                    const uploadDir = 'static/uploads';

                    const fs = await import('fs');
                    const path = await import('path');
                    const resolvedUploadDir = path.resolve(process.cwd(), uploadDir);

                    if (!fs.existsSync(resolvedUploadDir)) {
                        fs.mkdirSync(resolvedUploadDir, { recursive: true });
                    }

                    fs.writeFileSync(path.join(resolvedUploadDir, finalFilename), buffer);

                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({ success: true, url: `/uploads/${finalFilename}` }, null, 2)
                            }
                        ]
                    };
                } catch (/** @type {any} */ localErr) {
                    console.error('[MCP Upload] Local storage error:', localErr);
                    return {
                        isError: true,
                        content: [{ type: 'text', text: `Local upload failed: ${localErr.message}` }]
                    };
                }
            }
        }

        default:
            return {
                isError: true,
                content: [{ type: 'text', text: `Tool "${name}" is not implemented.` }]
            };
    }
}
