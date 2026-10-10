import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').LayoutServerLoad} */
export const load = async ({ url }) => {
    // Redirect all old writer pages to the new central Writer CMS in Admin
    const targetPath = url.pathname.replace(/^\/writer/, '/admin/writer');
    throw redirect(307, `https://admin.getmaterio.app${targetPath}${url.search}`);
};
