import { json } from '@sveltejs/kit';
import { validateToken } from '$lib/server/auth.js';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/**
 * @param {string} text
 */
function slugify(text) {
    if (!text) return '';
    return text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');
}

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function POST({ request, url, fetch }) {
    // 1. Authenticate
    const authHeader = request.headers.get('Authorization');
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        token = url.searchParams.get('token') || '';
    }

    if (!token) {
        return json({ success: false, error: 'Unauthorized: Missing Token' }, { status: 401, headers: corsHeaders });
    }

    const { user, accessTier } = await validateToken(token, fetch, url);
    if (!user || accessTier !== 'super') {
        return json({ success: false, error: 'Unauthorized: Admin privileges required' }, { status: 403, headers: corsHeaders });
    }

    // 2. Parse multipart form data
    let formData;
    try {
        formData = await request.formData();
    } catch (err) {
        return json({ success: false, error: 'Failed to parse form data' }, { status: 400, headers: corsHeaders });
    }

    const imageFile = formData.get('image');
    if (!imageFile || !(imageFile instanceof File)) {
        return json({ success: false, error: 'Missing or invalid "image" file in form data' }, { status: 400, headers: corsHeaders });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileType = imageFile.type || 'image/png';
    const originalName = imageFile.name || 'upload.png';

    // 3. Upload to Cloudinary or Local
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
            return json({ success: true, url: uploadResult.secure_url }, { headers: corsHeaders });
        } catch (cloudinaryErr) {
            console.error('[API Upload] Cloudinary error:', cloudinaryErr);
            return json({ success: false, error: 'Cloudinary upload failed' }, { status: 500, headers: corsHeaders });
        }
    } else {
        // Fallback to local upload
        try {
            const ext = fileType.split('/').pop() || 'png';
            const namePart = slugify(originalName.split('.')[0]) || `${Date.now()}`;
            const finalFilename = `${namePart}-${Math.round(Math.random() * 1000)}.${ext}`;
            const uploadDir = 'static/uploads';

            const resolvedUploadDir = path.resolve(process.cwd(), uploadDir);

            if (!fs.existsSync(resolvedUploadDir)) {
                fs.mkdirSync(resolvedUploadDir, { recursive: true });
            }

            fs.writeFileSync(path.join(resolvedUploadDir, finalFilename), buffer);

            return json({ success: true, url: `/uploads/${finalFilename}` }, { headers: corsHeaders });
        } catch (localErr) {
            console.error('[API Upload] Local storage error:', localErr);
            return json({ success: false, error: 'Local upload failed' }, { status: 500, headers: corsHeaders });
        }
    }
}
