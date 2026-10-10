import { redirect } from '@sveltejs/kit';

export const load = async () => {
    throw redirect(307, 'https://admin.getmaterio.app/admin/writer');
};
