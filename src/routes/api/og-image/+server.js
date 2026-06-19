import { error } from '@sveltejs/kit';

export const prerender = false;

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, fetch }) {
    let imageUrl = url.searchParams.get('url');
    if (!imageUrl) {
        throw error(400, 'Missing url parameter');
    }

    // Resolve relative URLs to the request's origin
    if (imageUrl.startsWith('/')) {
        imageUrl = `${url.origin}${imageUrl}`;
    }

    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        // Use Bun's built-in Image API if available (Bun 1.3.14+)
        // @ts-ignore
        if (typeof Bun !== 'undefined' && Bun.Image) {
            // @ts-ignore
            const image = new Bun.Image(arrayBuffer);

            // Crop and resize to 1200x630 (OpenGraph standard size/aspect ratio)
            // fit: 'cover' will preserve aspect ratio by cropping/zooming to cover the entire size
            const processedBuffer = await image
                .resize(1200, 630, { fit: 'cover' })
                .png()
                .toBuffer();

            return new Response(processedBuffer, {
                headers: {
                    'Content-Type': 'image/png',
                    'Cache-Control': 'public, max-age=604800, immutable'
                }
            });
        }

        // Fallback: return original image if Bun.Image is not available (for versions < 1.3.14)
        console.warn('Bun.Image is not available on this version of Bun. Returning original image directly.');
        const contentType = response.headers.get('Content-Type') || 'image/jpeg';
        return new Response(arrayBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400'
            }
        });
    } catch (e) {
        console.error('Failed to resize og-image:', e);
        // Fallback to returning the original image directly
        try {
            const response = await fetch(imageUrl);
            if (response.ok) {
                const contentType = response.headers.get('Content-Type') || 'image/jpeg';
                const arrayBuffer = await response.arrayBuffer();
                return new Response(arrayBuffer, {
                    headers: {
                        'Content-Type': contentType,
                        'Cache-Control': 'public, max-age=86400'
                    }
                });
            }
        } catch (fallbackErr) {
            console.error('Fallback failed:', fallbackErr);
        }
        throw error(500, 'Failed to process image');
    }
}
