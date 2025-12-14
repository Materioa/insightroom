/** @type {import('./$types').LayoutServerLoad} */
export const load = async ({ cookies, fetch, url }) => {
    // Check if token is passed via URL query params (cross-domain login)
    const urlToken = url.searchParams.get('token');
    if (urlToken) {
        cookies.set('materio_auth_token', urlToken, {
            path: '/',
            httpOnly: false, // Accessible to client-side JS if needed
            secure: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });
    }

    // Read token from cookies (either existing or just set)
    const token = cookies.get('materio_auth_token') || urlToken;

    if (!token) {
        return { user: null, accessTier: 'guest' };
    }

    try {
        const response = await fetch('https://materioa.vercel.app/api/v2/profile', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const userData = await response.json();
            const user = userData.user;

            // Determine access tier
            let accessTier = 'normal';
            if (user?.hasAdminPrivileges) {
                accessTier = 'super';
            } else if (user?.isPlusUser) {
                accessTier = 'plus';
            }

            return { user, accessTier, token };
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
    }

    return { user: null, accessTier: 'guest' };
};
