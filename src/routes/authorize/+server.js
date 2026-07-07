import { env } from '$env/dynamic/private';

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function GET({ url }) {
    // Claude and other AI clients sometimes force the Authorization URL to be on the same domain as the API.
    // This proxy redirects the browser seamlessly to the actual Materio SSO portal.
    const authBaseUrl = env.AUTH_URL || 'https://getmaterio.app';
    const ssoUrl = new URL(`${authBaseUrl}/account/sso`);
    for (const [key, value] of url.searchParams.entries()) {
        ssoUrl.searchParams.append(key, value);
    }
    
    return new Response(null, {
        status: 302,
        headers: {
            Location: ssoUrl.toString()
        }
    });
}
