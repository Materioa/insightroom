import { json } from '@sveltejs/kit';
import { getAnalyticsCollection } from '$lib/server/analytics.js';
import { isBot } from '$lib/server/botDetect.js';

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ request, getClientAddress }) => {
    try {
        // 1. Check if the request is from a crawler or bot
        if (isBot(request)) {
            return json({ success: true, message: 'Ignored bot request' });
        }

        const payload = await request.json();
        const {
            postId,
            slug,
            title,
            sessionId,
            duration,
            scrollDepth,
            lastLeftOff,
            claps,
            clicks,
            settingsChanges
        } = payload;

        if (!postId || !sessionId) {
            return json({ error: 'postId and sessionId are required' }, { status: 400 });
        }

        // 2. Resolve client IP and geolocation headers
        let ip = '127.0.0.1';
        try {
            ip = getClientAddress();
        } catch (e) {
            // Local development or custom adapter without getClientAddress
            ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
        }

        const country = request.headers.get('x-vercel-ip-country') || 'Unknown';
        const region = request.headers.get('x-vercel-ip-country-region') || 'Unknown';
        const city = request.headers.get('x-vercel-ip-city') || 'Unknown';

        const collection = await getAnalyticsCollection();

        // 3. Upsert session data in MongoDB
        const result = await collection.findOneAndUpdate(
            { postId, sessionId },
            {
                $set: {
                    slug: slug || '',
                    title: title || '',
                    ip,
                    country,
                    region,
                    city,
                    duration: Math.round(Number(duration || 0)),
                    scrollDepth: Math.min(100, Math.max(0, Math.round(Number(scrollDepth || 0)))),
                    lastLeftOff: lastLeftOff || '',
                    claps: Math.round(Number(claps || 0)),
                    clicks: clicks || [],
                    settingsChanges: settingsChanges || [],
                    updatedAt: new Date()
                },
                $setOnInsert: {
                    createdAt: new Date()
                }
            },
            { upsert: true, returnDocument: 'after' }
        );

        return json({ success: true, sessionId: result?.sessionId || sessionId });
    } catch (error) {
        console.error('[Analytics Ingestion] Failed to save telemetry:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
