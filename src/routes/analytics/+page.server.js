import { redirect } from '@sveltejs/kit';
import { getGeneralAnalytics } from '$lib/server/analytics.js';

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ parent }) => {
    const { user, accessTier } = await parent();

    if (!user || accessTier !== 'super') {
        throw redirect(302, '/');
    }

    const analytics = await getGeneralAnalytics(30);

    return {
        user,
        analytics
    };
};
