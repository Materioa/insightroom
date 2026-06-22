import { json } from '@sveltejs/kit';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '$env/dynamic/private';
import { validateToken } from '$lib/server/auth.js';
import fs from 'fs';
import path from 'path';

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function POST({ request, cookies, fetch, url }) {
    // Basic auth check supporting both Cookies and Bearer tokens
    let token = cookies.get('materio_auth_token');
    const authHeader = request.headers.get('Authorization');
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }
    if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

    const { user, accessTier } = await validateToken(token, fetch, url);
    if (!user || accessTier !== 'super') {
        return json({ error: 'Unauthorized: Admin privileges required' }, { status: 403 });
    }

    /** @type {any} */
    let buffer;
    let fileType = 'image/png';
    let originalName = 'upload.png';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        const body = await request.json();
        const { image, filePath, filename } = body;
        if (!image && !filePath) {
            return json({ error: 'Either image (base64/URL) or filePath is required in the JSON payload' }, { status: 400 });
        }
        if (filename) {
            originalName = filename;
        }

        if (filePath) {
            if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
                // Fetch external image
                try {
                    const imgRes = await fetch(filePath);
                    if (!imgRes.ok) throw new Error(`Status ${imgRes.status}`);
                    fileType = imgRes.headers.get('Content-Type') || 'image/png';
                    const arrayBuffer = await imgRes.arrayBuffer();
                    buffer = Buffer.from(arrayBuffer);
                } catch (err) {
                    // @ts-ignore
                    console.error('Failed to fetch external URL from filePath:', err.message);
                    // @ts-ignore
                    return json({ error: `Failed to fetch image URL from filePath: ${err.message}` }, { status: 400 });
                }
            } else {
                // Read local file
                try {
                    const resolvedPath = path.resolve(filePath);
                    if (!fs.existsSync(resolvedPath)) {
                        return json({ error: `Local file not found at path: ${filePath}` }, { status: 400 });
                    }
                    buffer = fs.readFileSync(resolvedPath);
                    // Guess file type from extension
                    const ext = path.extname(filePath).toLowerCase();
                    if (ext === '.jpg' || ext === '.jpeg') fileType = 'image/jpeg';
                    else if (ext === '.gif') fileType = 'image/gif';
                    else if (ext === '.webp') fileType = 'image/webp';
                    else if (ext === '.svg') fileType = 'image/svg+xml';

                    if (!filename) {
                        originalName = path.basename(filePath);
                    }
                } catch (err) {
                    // @ts-ignore
                    console.error('Failed to read local file from filePath:', err.message);
                    // @ts-ignore
                    return json({ error: `Failed to read local file: ${err.message}` }, { status: 500 });
                }
            }
        } else if (image) {
            if (image.startsWith('data:')) {
                // Parse base64 data URI
                const match = image.match(/^data:([^;]+);base64,(.+)$/);
                if (!match) {
                    return json({ error: 'Invalid base64 image data URI format' }, { status: 400 });
                }
                fileType = match[1];
                buffer = Buffer.from(match[2], 'base64');
            } else if (image.startsWith('http://') || image.startsWith('https://')) {
                // Fetch external image
                try {
                    const imgRes = await fetch(image);
                    if (!imgRes.ok) throw new Error(`Status ${imgRes.status}`);
                    fileType = imgRes.headers.get('Content-Type') || 'image/png';
                    const arrayBuffer = await imgRes.arrayBuffer();
                    buffer = Buffer.from(arrayBuffer);
                } catch (err) {
                    // @ts-ignore
                    console.error('Failed to fetch external URL:', err.message);
                    // @ts-ignore
                    return json({ error: `Failed to fetch image URL: ${err.message}` }, { status: 400 });
                }
            } else {
                // Raw base64 string
                buffer = Buffer.from(image, 'base64');
            }
        }
    } else {
        const data = await request.formData();
        const file = data.get('file');

        if (!file || !(file instanceof File)) {
            return json({ error: 'No file uploaded' }, { status: 400 });
        }
        originalName = file.name;
        fileType = file.type;
        const arrayBuffer = await file.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
    }

    const isVideo = fileType.startsWith('video/') || 
                    ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(originalName.split('.').pop()?.toLowerCase() || '');

    // If Cloudinary is configured, use it
    if (env.CLOUDINARY_URL || (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)) {
        cloudinary.config({
            cloud_name: env.CLOUDINARY_CLOUD_NAME,
            api_key: env.CLOUDINARY_API_KEY,
            api_secret: env.CLOUDINARY_API_SECRET
        });

        try {
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: 'insightroom', resource_type: 'auto' },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                uploadStream.end(buffer);
            });
            // @ts-ignore
            return json({ url: result.secure_url });
        } catch (err) {
            console.error('Cloudinary output err:', err);
            return json({ error: 'Cloudinary upload failed' }, { status: 500 });
        }
    } else {
        // Fallback to local upload inside static/uploads
        try {
            const ext = originalName.split('.').pop() || 'png';
            const filename = `${Date.now()}-${Math.round(Math.random() * 1000)}.${ext}`;
            const uploadDir = path.resolve(process.cwd(), 'static/uploads');
            
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            fs.writeFileSync(path.join(uploadDir, filename), buffer);
            
            return json({ url: `/uploads/${filename}` });
        } catch (err) {
            console.error('Local upload failed:', err);
            return json({ error: 'Local upload failed' }, { status: 500 });
        }
    }
}
