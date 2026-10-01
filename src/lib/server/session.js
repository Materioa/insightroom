import { validateToken, getCookieToken, LEGACY_SESSION_COOKIE } from '$lib/server/auth.js';

/**
 * Cache policy for pages that are identical for every visitor. The CDN serves
 * them for 30s and refreshes in the background, so CMS edits show up quickly
 * without a rebuild.
 */
export const PUBLIC_PAGE_CACHE = 'public, max-age=0, s-maxage=30, stale-while-revalidate=120';
export const NO_STORE = 'private, no-store';

/**
 * Resolve the current user from the request cookies. Only call this from
 * responses that are marked `NO_STORE`, since the result is user-specific.
 *
 * @param {{ cookies: import('@sveltejs/kit').Cookies, fetch: typeof fetch }} event
 */
export async function getSession({ cookies, fetch }) {
    const token = getCookieToken(cookies);
    if (!token) return { user: null, accessTier: 'guest' };

    const session = await validateToken(token, fetch);
    // Stale cookie from the deprecated auth system. The shared materio_token
    // cookie is owned by auth.getmaterio.app, so we never delete that one here.
    if (!session.user && cookies.get(LEGACY_SESSION_COOKIE)) {
        cookies.delete(LEGACY_SESSION_COOKIE, { path: '/' });
    }
    return session;
}

/** @param {string} tier */
export const canReadPrivate = (tier) => tier === 'super' || tier === 'plus';

/**
 * True when the response cannot be shared between visitors: a Materio session
 * cookie is present, an appearance cookie changes the markup, or the request is
 * not a plain document navigation.
 *
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @param {Request} request
 */
export function isVisitorSpecific(cookies, request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return true;

    // SvelteKit's client-side navigation and data requests must not be served
    // from a shared cache, or one visitor's payload could leak to another.
    if (request.headers.get('x-sveltekit-invalidated')) return true;
    if (request.headers.get('accept')?.includes('text/x-component')) return true;

    if (getCookieToken(cookies)) return true;

    // Appearance cookies change the rendered HTML (colour mode picks the syntax
    // highlighting theme, `font` picks the typeface).
    return ['theme', 'font'].some((name) => cookies.get(name));
}
