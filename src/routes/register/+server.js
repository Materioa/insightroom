import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import crypto from 'crypto';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

/**
 * Dynamic Client Registration (RFC 7591)
 * Claude and other MCP clients use this to register themselves dynamically.
 * Since our auth is handled by Materio's backend, we store the client metadata
 * and return the client_id that the MCP client will use for OAuth flows.
 */
/** @type {import('@sveltejs/kit').RequestHandler} */
export async function POST({ request }) {
    try {
        const body = await request.json();

        // Extract client metadata from the registration request
        const {
            client_name,
            redirect_uris,
            grant_types,
            response_types,
            token_endpoint_auth_method,
            scope,
            client_uri,
            logo_uri,
            contacts
        } = body;

        // Validate required fields
        if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
            return json({
                error: 'invalid_client_metadata',
                error_description: 'redirect_uris is required and must be a non-empty array'
            }, { status: 400, headers: corsHeaders });
        }

        // Generate a unique client_id
        const client_id = `mcp_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;
        // For public clients (PKCE), no client_secret is needed
        const isPublicClient = !token_endpoint_auth_method || token_endpoint_auth_method === 'none';

        const clientRecord = {
            client_id,
            client_name: client_name || 'MCP Client',
            redirect_uris,
            grant_types: grant_types || ['authorization_code'],
            response_types: response_types || ['code'],
            token_endpoint_auth_method: token_endpoint_auth_method || 'none',
            scope: scope || 'admin',
            client_uri: client_uri || null,
            logo_uri: logo_uri || null,
            contacts: contacts || [],
            is_public: isPublicClient,
            created_at: new Date()
        };

        // Store in MongoDB for reference
        const db = await getDb();
        const clientsCol = db.collection('oauth_clients');
        await clientsCol.insertOne(clientRecord);

        // Return registration response per RFC 7591
        const response = {
            client_id,
            client_name: clientRecord.client_name,
            redirect_uris: clientRecord.redirect_uris,
            grant_types: clientRecord.grant_types,
            response_types: clientRecord.response_types,
            token_endpoint_auth_method: clientRecord.token_endpoint_auth_method,
            scope: clientRecord.scope,
            client_id_issued_at: Math.floor(Date.now() / 1000)
        };

        // If not a public client, generate a secret
        if (!isPublicClient) {
            const client_secret = crypto.randomBytes(32).toString('hex');
            await clientsCol.updateOne(
                { client_id },
                { $set: { client_secret } }
            );
            response.client_secret = client_secret;
            response.client_secret_expires_at = 0; // Never expires
        }

        return json(response, {
            status: 201,
            headers: {
                ...corsHeaders,
                'Cache-Control': 'no-store'
            }
        });
    } catch (err) {
        console.error('[DCR Error]', err);
        return json({
            error: 'server_error',
            error_description: 'Failed to register client'
        }, { status: 500, headers: corsHeaders });
    }
}
