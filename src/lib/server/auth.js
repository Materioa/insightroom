import { env } from '$env/dynamic/private';

/** Shared session cookie issued by auth.getmaterio.app (Domain=.getmaterio.app in production). */
export const SESSION_COOKIE = 'materio_token';
/** Cookie name used by the deprecated auth system. Read as a fallback and cleaned up once invalid. */
export const LEGACY_SESSION_COOKIE = 'materio_auth_token';

export const AUTH_URL = (env.AUTH_URL || 'https://auth.getmaterio.app').replace(/\/$/, '');

/** @param {string} hostname */
export function isProdHost(hostname) {
    return hostname === 'getmaterio.app' || hostname.endsWith('.getmaterio.app');
}

/**
 * Cookie options matching Materio's shared-session config so the cookie is
 * shared with auth/accounts/admin and every other *.getmaterio.app app.
 * @param {URL} url
 */
export function sessionCookieOptions(url) {
    const prod = isProdHost(url.hostname);
    return /** @type {const} */ ({
        path: '/',
        domain: prod ? '.getmaterio.app' : undefined,
        secure: prod,
        httpOnly: false, // auth app reads this client-side for silent SSO
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7
    });
}

/**
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @returns {string}
 */
export function getCookieToken(cookies) {
    return cookies.get(SESSION_COOKIE) || cookies.get(LEGACY_SESSION_COOKIE) || '';
}

// Shared server-side cache so we don't hit the auth API on every request.
/** @type {Map<string, { data: { user: any, accessTier: string }, expires: number }>} */
const tokenCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

/**
 * Only the fields the app needs. /api/v2/profile also returns recoveryKey,
 * 2FA state etc., which must never reach the browser.
 * @param {any} u
 */
function sanitizeUser(u) {
    return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        profilePicture: u.profilePicture,
        hasAdminPrivileges: !!u.hasAdminPrivileges,
        isPlusUser: !!u.isPlusUser,
        isLiteUser: !!u.isLiteUser
    };
}

/**
 * Validates a session or OAuth access token against auth.getmaterio.app.
 * Works for browser session tokens and MCP OAuth access tokens alike.
 *
 * @param {string | undefined} token
 * @param {typeof fetch} fetchFn
 * @returns {Promise<{ user: any, accessTier: string }>}
 */
export async function validateToken(token, fetchFn) {
    const guest = { user: null, accessTier: 'guest' };
    if (!token) return guest;

    const cached = tokenCache.get(token);
    if (cached && cached.expires > Date.now()) return cached.data;

    try {
        const res = await fetchFn(`${AUTH_URL}/api/v2/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return guest;

        const body = await res.json();
        const raw = body.user || body;
        if (!raw?.id) return guest;

        const user = sanitizeUser(raw);
        const banned = body.suspended === true || raw.isBanned === true;

        let accessTier = 'normal';
        if (!banned) {
            if (user.hasAdminPrivileges) accessTier = 'super';
            else if (user.isPlusUser) accessTier = 'plus';
        }

        const data = { user, accessTier };
        if (tokenCache.size >= MAX_CACHE_ENTRIES) {
            const oldest = tokenCache.keys().next().value;
            if (oldest) tokenCache.delete(oldest);
        }
        tokenCache.set(token, { data, expires: Date.now() + CACHE_DURATION });
        return data;
    } catch (err) {
        console.error('[auth] validation network error:', /** @type {Error} */ (err).message);
        return guest;
    }
}
