import { json } from '@sveltejs/kit';
import { SESSION_COOKIE, LEGACY_SESSION_COOKIE, isProdHost } from '$lib/server/auth.js';

/**
 * Clears the shared session cookie (signs the user out of all Materio apps).
 * @type {import('@sveltejs/kit').RequestHandler}
 */
export async function POST({ url, cookies }) {
    if (isProdHost(url.hostname)) {
        cookies.delete(SESSION_COOKIE, { path: '/', domain: '.getmaterio.app' });
    }
    cookies.delete(SESSION_COOKIE, { path: '/' });
    cookies.delete(LEGACY_SESSION_COOKIE, { path: '/' });
    return json({ ok: true });
}
