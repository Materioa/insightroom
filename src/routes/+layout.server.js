/** @type {import('./$types').LayoutServerLoad} */
export const load = async ({ cookies, fetch }) => {
    const token = cookies.get('materio_auth_token');

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

            return { user, accessTier };
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
    }

    return { user: null, accessTier: 'guest' };
};
