import { redirect } from '@sveltejs/kit';

export const load = async () => {
    throw redirect(307, 'https://id.getmaterio.app/admin/writer');
};
