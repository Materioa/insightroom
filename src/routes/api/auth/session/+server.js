import { json } from '@sveltejs/kit';
import { getSession, NO_STORE } from '$lib/server/session.js';

/**
 * Resolves the current Materio ID session for the client.
 *
 * Page responses are cached and identical for every visitor, so the session is
 * loaded here after hydration rather than during SSR. Visitor-specific, so it
 * must never be cached.
 *
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ cookies, fetch }) {
    const { user, accessTier } = await getSession({ cookies, fetch });

    return json({ user, accessTier }, { headers: { 'cache-control': NO_STORE } });
}
