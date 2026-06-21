import { json } from '@sveltejs/kit';
import { validateToken } from '$lib/server/auth.js';
import { getPostsCollection, getDb } from '$lib/server/db.js';
import { getAllPosts, getPost, getPostByPermalink } from '$lib/server/posts.js';
import { ObjectId } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '$env/dynamic/private';
import crypto from 'crypto';
import { resolveAttribution } from '$lib/attribution.js';

// In-memory registry of active SSE streams (for environments where processes persist)
/** @type {Map<string, ReadableStreamDefaultController>} */
const activeSessions = new Map();

// Helper to send JSON-RPC event to SSE stream

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/** @type {import('./$types').RequestHandler} */
export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}
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
        return new Response('Unauthorized: Missing Token', {
            status: 401,
            headers: {
                'WWW-Authenticate': `Bearer error="invalid_token", metadata="${url.origin}/.well-known/oauth-protected-resource"`,
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    // Validate Token and Access Tier (Must be super user / admin)
    let tokenValidationResult;
    try {
        tokenValidationResult = await validateToken(token, fetch, url);
    } catch (e) {
        tokenValidationResult = { user: null, accessTier: null };
    }
    const { user, accessTier } = tokenValidationResult;

    // Log the GET request details for debugging
    try {
        const db = await getDb();
        const debugCol = db.collection('mcp_debug_logs');
        /** @type {Record<string, string>} */
        const headersObj = {};
        for (const [k, v] of request.headers.entries()) {
            if (k.toLowerCase() === 'authorization') {
                headersObj[k] = v.substring(0, 15) + '...';
            } else {
                headersObj[k] = v;
            }
        }
        await debugCol.insertOne({
            timestamp: new Date(),
            method: 'GET',
            url: url.toString(),
            searchParams: Object.fromEntries(url.searchParams.entries()),
            headers: headersObj,
            authSuccess: !!(user && accessTier === 'super')
        });
    } catch (e) {
        console.error('[MCP Debug Log] Failed to write log:', e);
    }

    if (!user || accessTier !== 'super') {
        return new Response('Unauthorized: Admin access required', {
            status: 403,
            headers: {
                'WWW-Authenticate': `Bearer error="insufficient_scope", metadata="${url.origin}/.well-known/oauth-protected-resource"`,
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    // 3. Setup SSE Stream
    const sessionId = crypto.randomUUID();
    const stream = new ReadableStream({
        start(controller) {
            activeSessions.set(sessionId, controller);

            // Send initial endpoint message to let the client know where to send POST messages
            const endpointUri = `${url.origin}${url.pathname}?sessionId=${sessionId}&token=${encodeURIComponent(token)}`;
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
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no'
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

    // Read JSON-RPC request ID safely to ensure valid JSON-RPC format
    let rpcId = null;
    let bodyData = null;
    try {
        const clonedReq = request.clone();
        bodyData = await clonedReq.json();
        rpcId = bodyData.id || null;
    } catch {}

    // Log the request details for debugging
    try {
        const db = await getDb();
        const debugCol = db.collection('mcp_debug_logs');
        /** @type {Record<string, string>} */
        const headersObj = {};
        for (const [k, v] of request.headers.entries()) {
            // Mask authorization token for privacy
            if (k.toLowerCase() === 'authorization') {
                headersObj[k] = v.substring(0, 15) + '...';
            } else {
                headersObj[k] = v;
            }
        }
        await debugCol.insertOne({
            timestamp: new Date(),
            method: 'POST',
            url: url.toString(),
            searchParams: Object.fromEntries(url.searchParams.entries()),
            headers: headersObj,
            body: bodyData
        });
    } catch (e) {
        console.error('[MCP Debug Log] Failed to write log:', e);
    }

    if (!token) {
        return json({
            jsonrpc: '2.0',
            id: rpcId,
            error: { code: -32001, message: 'Unauthorized: Missing Token' }
        }, { headers: corsHeaders });
    }

    const { user, accessTier } = await validateToken(token, fetch, url);
    if (!user || accessTier !== 'super') {
        return json({
            jsonrpc: '2.0',
            id: rpcId,
            error: { code: -32003, message: 'Unauthorized: Admin privileges required' }
        }, { headers: corsHeaders });
    }

    // 2. Parse JSON-RPC message
    let body;
    try {
        body = await request.json();
    } catch (err) {
        return json({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null }, { status: 400, headers: corsHeaders });
    }

    const { jsonrpc, id, method, params } = body;
    if (jsonrpc !== '2.0' || !method) {
        return json({ jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: id || null }, { status: 400, headers: corsHeaders });
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
                            description: 'Create and publish a new post in the insightroom database.',
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
                            description: 'Update or edit details, content, or metadata of an existing published post.',
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
                result = await handleToolCall(name, args, user, request);
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

    return json(responsePayload, { headers: corsHeaders });
}

/**
 * Core handler to process MCP Tool calls
 * @param {string} name
 * @param {any} args
 * @param {any} currentUser
 * @param {Request} request
 */
async function handleToolCall(name, args, currentUser, request) {
    const collection = await getPostsCollection();
    const db = await getDb();

    switch (name) {
        case 'list_posts': {
            const posts = await getAllPosts();
            const lightweightPosts = posts.map(post => ({
                id: post.id,
                title: post.title,
                slug: post.slug,
                categorySlug: post.categorySlug,
                date: post.date,
                url: post.url,
                hidden: post.hidden,
                draft: post.draft,
                visibility: post.visibility,
                excerpt: post.excerpt,
                image: post.image
            }));
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(lightweightPosts, null, 2)
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

            // Automatically resolve author avatar and display name
            const attribution = resolveAttribution({
                author_name: metadata.author_name,
                author_avatar: metadata.author_avatar
            }, request.headers);

            metadata.author_name = metadata.author_name || attribution.displayName;
            metadata.author_avatar = metadata.author_avatar || attribution.avatar;

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

            // Resolve editor avatar and details
            const attribution = resolveAttribution({
                saved_by_name,
                saved_by_display_name,
                saved_by_avatar
            }, request.headers);

            // Save previous version in version history
            const versionsCollection = db.collection('post_versions');
            await versionsCollection.insertOne({
                post_id: oldPost._id,
                title: oldPost.title,
                content: oldPost.content,
                metadata: oldPost.metadata || {},
                updated_at: oldPost.updated_at || oldPost.created_at || new Date(),
                saved_by_name: attribution.name,
                saved_by_display_name: attribution.displayName,
                saved_by_avatar: attribution.avatar,
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
                // Automatically resolve author avatar and details
                const authorAttribution = resolveAttribution({
                    author_name: metadata.author_name,
                    author_avatar: metadata.author_avatar
                }, request.headers);
                
                metadata.author_name = metadata.author_name || authorAttribution.displayName;
                metadata.author_avatar = metadata.author_avatar || authorAttribution.avatar;

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
