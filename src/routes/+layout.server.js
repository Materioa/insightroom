import { redirect, isRedirect } from '@sveltejs/kit';
import { validateToken } from '$lib/server/auth.js';

/** @type {import('./$types').LayoutServerLoad} */
export const load = async ({ cookies, fetch, url }) => {
    // Prefer local auth service in localhost development, but fallback to production auth.
    const isDevHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const authBaseUrls = isDevHost
        ? ['http://localhost:1000', 'https://getmaterio.app', 'https://materioa.vercel.app']
        : ['https://getmaterio.app', 'https://materioa.vercel.app'];

    // Check if a handoff code is present in URL (secure cross-domain login)
    const handoffCode = url.searchParams.get('handoff');

    if (handoffCode) {
        try {
            /** @type {null | { token: string, user: any }} */
            let exchangeResult = null;

            for (const authBaseUrl of authBaseUrls) {
                try {
                    console.log(`Attempting handoff exchange with auth server: ${authBaseUrl}`);
                    const exchangeResponse = await fetch(`${authBaseUrl}/api/v2/login`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ code: handoffCode })
                    });

                    if (!exchangeResponse.ok) {
                        const errBody = await exchangeResponse.text();
                        console.warn(`Handoff exchange failed for ${authBaseUrl}: Status ${exchangeResponse.status}, Error: ${errBody}`);
                        continue;
                    }

                    const exchangeData = await exchangeResponse.json();
                    const token = exchangeData.token;
                    // Handle both response formats: wrapped in 'user' property or direct user data
                    const user = exchangeData.user || exchangeData;

                    if (token) {
                        console.log(`Successfully exchanged handoff token for user: ${user.username || user.email}`);
                        exchangeResult = { token, user };
                        break;
                    } else {
                        console.warn(`Auth server ${authBaseUrl} responded with OK, but no token was found:`, exchangeData);
                    }
                } catch (err) {
                    // @ts-ignore
                    console.error(`Handoff exchange network error for ${authBaseUrl}:`, err.message);
                }
            }

            if (exchangeResult?.token) {
                // Store the token in cookies
                cookies.set('materio_auth_token', exchangeResult.token, {
                    path: '/',
                    httpOnly: false,
                    secure: !isDevHost,  // Only require HTTPS in production
                    sameSite: 'lax',
                    maxAge: 60 * 60 * 24 * 7 // 7 days
                });
            }

            // Always clean the URL after attempting handoff to avoid stale code loops.
            const cleanUrl = new URL(url);
            cleanUrl.searchParams.delete('handoff');
            const cleanPath = cleanUrl.pathname + cleanUrl.search;
            throw redirect(302, cleanPath);
        } catch (error) {
            // Re-throw redirects (SvelteKit's Redirect is not an Error instance)
            if (isRedirect(error)) {
                throw error;
            }
            // Log other errors for debugging
            console.error('Handoff exchange error:', error);
        }
    }

    const theme = cookies.get('theme') || 'system';
    const font = cookies.get('font') || 'default';

    // Read token from cookies (for returning users)
    const token = cookies.get('materio_auth_token');

    if (!token) {
        return { user: null, accessTier: 'guest', theme, font };
    }

    const { user, accessTier } = await validateToken(token, fetch, url);

    if (user) {
        return { user, accessTier, token, theme, font };
    }

    // Token is invalid or expired, clear it
    cookies.delete('materio_auth_token', { path: '/' });

    return { user: null, accessTier: 'guest', theme, font };
};
