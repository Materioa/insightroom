import { json } from '@sveltejs/kit';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';

export async function POST({ request, cookies }) {
    const token = cookies.get('materio_auth_token');
    if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

    const data = await request.formData();
    const file = data.get('file');

    if (!file || !(file instanceof File)) {
        return json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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
                    { folder: 'insightroom' },
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
            const ext = file.name.split('.').pop() || 'png';
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
