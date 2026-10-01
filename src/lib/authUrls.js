// Client-safe Materio ID URLs and helpers.
export const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'https://auth.getmaterio.app';
export const ACCOUNTS_URL = import.meta.env.VITE_ACCOUNTS_URL || 'https://accounts.getmaterio.app';

/**
 * Login via Materio ID. Auth redirects back to /auth/callback?code=...&next=...
 * @param {string} origin this app's origin
 * @param {string} [next] path to return to after login
 */
export function buildLoginUrl(origin, next = '/') {
    const callback = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
    return `${AUTH_URL}/login?callback=${encodeURIComponent(callback)}`;
}
