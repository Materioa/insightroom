import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').LayoutServerLoad} */
export const load = async ({ parent }) => {
    const { user, accessTier } = await parent();

    if (!user || accessTier !== 'super') {
        throw redirect(302, '/'); // Redirect home if not an admin. Or we can redirect to login.
    }

    return { user };
};
