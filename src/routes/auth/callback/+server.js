import { redirect } from '@sveltejs/kit';
import { AUTH_URL, SESSION_COOKIE, LEGACY_SESSION_COOKIE, sessionCookieOptions } from '$lib/server/auth.js';

/** Only allow same-site relative paths to avoid open redirects. */
/** @param {string | null} next */
function safeNext(next) {
    if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
    return next;
}

/**
 * Handoff callback from auth.getmaterio.app: exchange the 60s single-use code
 * for a session token, store it in the shared session cookie, then continue.
 * @type {import('@sveltejs/kit').RequestHandler}
 */
export async function GET({ url, cookies, fetch }) {
    const code = url.searchParams.get('code');
    const next = safeNext(url.searchParams.get('next'));

    if (code) {
        try {
            const res = await fetch(`${AUTH_URL}/api/v2/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'exchange', code })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.token) {
                cookies.set(SESSION_COOKIE, data.token, sessionCookieOptions(url));
                cookies.delete(LEGACY_SESSION_COOKIE, { path: '/' });
            } else {
                console.warn('[auth] handoff exchange failed:', res.status, data.error);
            }
        } catch (err) {
            console.error('[auth] handoff exchange error:', /** @type {Error} */ (err).message);
        }
    }

    throw redirect(303, next);
}
