/** @type {import('./$types').LayoutServerLoad} */
import { redirect, isRedirect } from '@sveltejs/kit';

export const load = async ({ cookies, fetch, url }) => {
    // Use localhost in development, production URL otherwise
    const isDev = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const AUTH_BASE_URL = isDev ? 'http://localhost:1000' : 'https://materioa.vercel.app';

    // Check if a handoff code is present in URL (secure cross-domain login)
    const handoffCode = url.searchParams.get('handoff');

    if (handoffCode) {
        try {
            // Exchange the one-time handoff code for a JWT token
            const exchangeResponse = await fetch(`${AUTH_BASE_URL}/api/v2/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code: handoffCode })
            });

            if (exchangeResponse.ok) {
                const exchangeData = await exchangeResponse.json();
                const token = exchangeData.token;
                // Handle both response formats: wrapped in 'user' property or direct user data
                const user = exchangeData.user || exchangeData;

                // Store the token in cookies
                cookies.set('materio_auth_token', token, {
                    path: '/',
                    httpOnly: false,
                    secure: !isDev,  // Only require HTTPS in production
                    sameSite: 'lax',
                    maxAge: 60 * 60 * 24 * 7 // 7 days
                });

                // Determine access tier from the user data returned by the exchange
                let accessTier = 'normal';
                if (user?.hasAdminPrivileges) {
                    accessTier = 'super';
                } else if (user?.isPlusUser) {
                    accessTier = 'plus';
                }

                // Clean the URL by removing the handoff parameter and redirect
                const cleanUrl = new URL(url);
                cleanUrl.searchParams.delete('handoff');
                const cleanPath = cleanUrl.pathname + cleanUrl.search;

                // Throw redirect to clean URL
                throw redirect(302, cleanPath);
            }
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

    // Validate the existing token by fetching user profile
    try {
        const response = await fetch(`${AUTH_BASE_URL}/api/v2/profile`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
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
        } else {
            // Token is invalid or expired, clear it
            cookies.delete('materio_auth_token', { path: '/' });
        }
    } catch (error) {
        // Silent fail - user will be treated as guest
    }

    return { user: null, accessTier: 'guest' };
};
