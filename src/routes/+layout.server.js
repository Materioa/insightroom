import { getSession, isVisitorSpecific, PUBLIC_PAGE_CACHE, NO_STORE } from '$lib/server/session.js';

/**
 * Routes that only ever show one admin's data. They set the stricter policy
 * themselves from here rather than calling `setHeaders` again — SvelteKit
 * allows one value per header per response, and the root layout runs first.
 *
 * @param {string} pathname
 */
function isAdminRoute(pathname) {
    return pathname === '/analytics' ||
        pathname === '/writer' ||
        pathname.startsWith('/writer/');
}

/**
 * Posts are written and published at runtime through Writer (`/api/admin/*`)
 * and the MCP server (`/mcp`), straight into MongoDB. Nothing prerendered at
 * build time could reflect a newly published post, so pages are rendered per
 * request and cached at the CDN instead — an anonymous response is byte
 * identical for every visitor, so the edge serves it and revalidates in the
 * background. A CMS edit goes live within ~30s with no rebuild.
 *
 * As soon as a response becomes visitor-specific — a Materio session cookie, an
 * appearance preference, an admin route, or a non-navigation request — it is
 * sent as `private, no-store` and the session is resolved for real.
 *
 * @type {import('./$types').LayoutServerLoad}
 */
export const load = async ({ cookies, fetch, request, setHeaders, url }) => {
    const theme = cookies.get('theme') || 'system';
    const font = cookies.get('font') || 'default';

    if (isAdminRoute(url.pathname) || isVisitorSpecific(cookies, request)) {
        setHeaders({ 'cache-control': NO_STORE });
        const session = await getSession({ cookies, fetch });

        return { ...session, theme, font };
    }

    setHeaders({ 'cache-control': PUBLIC_PAGE_CACHE });
    return { user: null, accessTier: 'guest', theme, font };
};
