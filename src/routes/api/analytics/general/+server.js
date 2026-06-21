import { json } from '@sveltejs/kit';
import { getGeneralAnalytics } from '$lib/server/analytics.js';
import { validateToken } from '$lib/server/auth.js';

/** @type {import('./$types').RequestHandler} */
export const GET = async ({ url, cookies, fetch, request }) => {
    try {
        // 1. Authenticate user (must be super admin)
        const authHeader = request.headers.get('Authorization');
        let token = '';
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else {
            token = cookies.get('materio_auth_token') || '';
        }

        const { user, accessTier } = await validateToken(token, fetch, url);
        if (!user || accessTier !== 'super') {
            return json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
        }

        // 2. Parse search parameters
        const daysParam = url.searchParams.get('days');
        const days = daysParam ? parseInt(daysParam, 10) : 30;

        // 3. Retrieve general collective analytics
        const analytics = await getGeneralAnalytics(days);

        return json(analytics);
    } catch (error) {
        console.error('[General Analytics API] Failed to fetch statistics:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
