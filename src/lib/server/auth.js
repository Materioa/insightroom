// Shared server-side authentication cache to reduce external API overhead and speed up TTFB (Time to First Byte)
/** @type {Map<string, { data: { user: any, accessTier: string }, expires: number }>} */
const tokenCache = new Map();

// Track connection failures for auth servers to avoid slow connection timeouts/refusals (e.g. localhost:1000 in dev)
/** @type {Map<string, number>} */
const failedEndpoints = new Map();

const CACHE_DURATION = 5 * 60 * 1000; // Cache valid profiles for 5 minutes
const COOLDOWN_DURATION = 60 * 1000; // 1 minute cooldown after a connection failure

/**
 * Validates a user authentication token with the authentication servers.
 * Implements an in-memory cache and connection failure cooldowns to ensure fast load times.
 * 
 * @param {string | undefined} token - The raw auth token.
 * @param {import('@sveltejs/kit').RequestEvent['fetch']} fetchFn - SvelteKit context-aware fetch function.
 * @param {URL} url - Request URL (used to detect development host).
 * @returns {Promise<{ user: any, accessTier: string }>}
 */
export async function validateToken(token, fetchFn, url) {
    if (!token) {
        return { user: null, accessTier: 'guest' };
    }

    const now = Date.now();

    // Check successful validation cache
    const cached = tokenCache.get(token);
    if (cached && cached.expires > now) {
        return cached.data;
    }

    const isDevHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const authBaseUrls = isDevHost
        ? ['http://localhost:1000', 'https://getmaterio.app', 'https://materioa.vercel.app']
        : ['https://getmaterio.app', 'https://materioa.vercel.app'];

    // Filter out endpoints that are currently in connection cooldown
    const activeUrls = authBaseUrls.filter(baseUrl => {
        const cooldownUntil = failedEndpoints.get(baseUrl);
        return !cooldownUntil || cooldownUntil < now;
    });

    // Fallback to all endpoints if all of them are in cooldown
    const endpointsToTry = activeUrls.length > 0 ? activeUrls : authBaseUrls;

    for (const authBaseUrl of endpointsToTry) {
        try {
            const response = await fetchFn(`${authBaseUrl}/api/v2/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errBody = await response.text();
                console.warn(`[AuthCache] Validation failed for ${authBaseUrl}: Status ${response.status}, Error: ${errBody}`);
                continue;
            }

            const userData = await response.json();
            const user = userData.user || userData;

            let accessTier = 'normal';
            if (user?.hasAdminPrivileges) {
                accessTier = 'super';
            } else if (user?.isPlusUser) {
                accessTier = 'plus';
            }

            const result = { user, accessTier };
            tokenCache.set(token, { data: result, expires: Date.now() + CACHE_DURATION });
            
            // Clean up any cooldown entries if we succeeded
            failedEndpoints.delete(authBaseUrl);
            
            return result;
        } catch (err) {
            // @ts-ignore
            console.error(`[AuthCache] Network error connecting to ${authBaseUrl}:`, err.message);
            // Put endpoint on cooldown so we don't try connecting again immediately
            failedEndpoints.set(authBaseUrl, Date.now() + COOLDOWN_DURATION);
        }
    }

    return { user: null, accessTier: 'guest' };
}
