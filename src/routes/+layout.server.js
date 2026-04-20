/** @type {import('./$types').LayoutServerLoad} */
import { redirect, isRedirect } from '@sveltejs/kit';

export const load = async ({ cookies, fetch, url }) => {
    // Prefer local auth service in localhost development, but fallback to production auth.
    const isDevHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const authBaseUrls = isDevHost
        ? ['http://localhost:1000', 'https://materioa.vercel.app']
        : ['https://materioa.vercel.app'];

    // Check if a handoff code is present in URL (secure cross-domain login)
    const handoffCode = url.searchParams.get('handoff');

    if (handoffCode) {
        try {
            /** @type {null | { token: string, user: any }} */
            let exchangeResult = null;

            for (const authBaseUrl of authBaseUrls) {
                try {
                    const exchangeResponse = await fetch(`${authBaseUrl}/api/v2/login`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ code: handoffCode })
                    });

                    if (!exchangeResponse.ok) {
                        continue;
                    }

                    const exchangeData = await exchangeResponse.json();
                    const token = exchangeData.token;
                    // Handle both response formats: wrapped in 'user' property or direct user data
                    const user = exchangeData.user || exchangeData;

                    if (token) {
                        exchangeResult = { token, user };
                        break;
                    }
                } catch {
                    // Try the next auth host.
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

    // Read token from cookies (for returning users)
    const token = cookies.get('materio_auth_token');

    if (!token) {
        return { user: null, accessTier: 'guest' };
    }

    // Validate the existing token by fetching user profile, with auth host fallback.
    for (const authBaseUrl of authBaseUrls) {
        try {
            const response = await fetch(`${authBaseUrl}/api/v2/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                continue;
            }

            const userData = await response.json();
            // Handle both response formats: wrapped in 'user' property or direct user data
            const user = userData.user || userData;

            // Determine access tier
            let accessTier = 'normal';
            if (user?.hasAdminPrivileges) {
                accessTier = 'super';
            } else if (user?.isPlusUser) {
                accessTier = 'plus';
            }

            return { user, accessTier, token };
        } catch {
            // Try the next auth host.
        }
    }

    // Token is invalid or expired, clear it
    cookies.delete('materio_auth_token', { path: '/' });

    return { user: null, accessTier: 'guest' };
};
