# The InsightRoom

Blog/CMS at [room.getmaterio.app](https://room.getmaterio.app), built with SvelteKit. Also exposes an MCP server at `/mcp` for AI clients.

## Development

```sh
npm install
cp .env.example .env   # fill in values
npm run dev
```

```sh
npm run build && npm run preview
```

### Rendering

The app is **server-rendered and not statically generated**. Posts are written and published at runtime through Writer (`/api/admin/*`) and the MCP server (`/mcp`), straight into MongoDB, so anything prerendered at build time would be frozen before it was ever published. There is no `prerender` anywhere.

To keep per-request SSR cheap, identical anonymous responses are cached at the CDN instead of being re-rendered per visitor:

| Response | Policy |
|---|---|
| Pages with no session or appearance cookie | `public, s-maxage=30, stale-while-revalidate=120` |
| Any response that resolves a session or a theme/font preference | `private, no-store` |
| `/writer/**`, `/analytics` | `private, no-store` (admin data) |
| Public post JSON (`/api/posts`) | `public, s-maxage=30, stale-while-revalidate=120` |

So a post published through the CMS goes live on the next revalidation (within ~30s), with no rebuild and no deploy.

This works because anonymous HTML is genuinely identical for every visitor:

- Public posts ship their rendered body in the SSR payload, so crawlers, AdSense and AI clients see full content without a client round trip.
- Private posts ship only the locked shell; the body is fetched client-side from `/api/posts/content/…`, which re-checks the session server-side. Private content therefore never appears in a cached HTML response, even for an authorised reader.
- The session itself is loaded after hydration from `/api/auth/session`, so cached pages carry no user data.

`src/lib/server/session.js` holds the two policies (`PUBLIC_PAGE_CACHE`, `NO_STORE`) and `isVisitorSpecific()`.

## Authentication (Materio ID)

This is a first-party app on `*.getmaterio.app` and uses Materio ID ([docs](https://github.com/Materioa/id/tree/master/docs), see `internal-integration.md`).

| | |
|---|---|
| Auth server | `https://auth.getmaterio.app` (override with `AUTH_URL`) |
| Session cookie | `materio_token`, `Domain=.getmaterio.app`, shared across all Materio apps |
| Token validation | `GET {AUTH}/api/v2/profile` (session JWTs and OAuth access tokens), cached 5 min |
| Access tiers | `super` = `hasAdminPrivileges`, `plus` = `isPlusUser`, else `normal` / `guest` |

### Login flow

1. Header / locked post → `{AUTH}/login?callback={origin}/auth/callback?next={path}`
2. User signs in (or silent SSO if already signed in elsewhere on Materio).
3. Auth redirects to `/auth/callback?code=…&next=…`.
4. `src/routes/auth/callback/+server.js` exchanges the 60s single-use code via `POST {AUTH}/api/v2/login {action:"exchange"}`, sets `materio_token`, redirects to `next` (relative paths only).

Logout: `POST /auth/logout` clears the shared cookie, which signs the user out of all Materio apps.

### Environment

`MONGODB_URI` and the Cloudinary keys are required. `AUTH_URL` / `VITE_AUTH_URL` / `VITE_ACCOUNTS_URL` override the Materio ID hosts for local development and default to production. See `.env.example`.

There is no `JWT_SECRET`: every authenticated route validates tokens against Materio ID via `validateToken`, which is shared by session cookies and OAuth access tokens alike.

### Code map

- `src/lib/server/auth.js`: `validateToken`, `getCookieToken`, cookie options
- `src/lib/server/session.js`: cache policies, `getSession`, `canReadPrivate`, `isVisitorSpecific`
- `src/lib/authUrls.js`: client-safe URLs and `buildLoginUrl`
- `src/lib/stores/session.js`: client-side session, populated from `/api/auth/session`
- `src/routes/+layout.server.js`: sets the cache policy and, for visitor-specific requests, `user` + `accessTier` (only a safe subset of the profile is exposed; `recoveryKey` and 2FA fields are stripped)

## MCP server

Endpoint: `https://room.getmaterio.app/mcp` (Streamable HTTP / SSE). Requires a Materio account with **admin privileges**.

Clients authenticate with OAuth 2.0 + PKCE against Materio ID. Some MCP clients require the authorization server to share the resource's origin, so this app publishes its own discovery documents and proxies to Materio ID:

| Endpoint | Behaviour |
|---|---|
| `/.well-known/oauth-protected-resource` | Resource metadata for `/mcp` |
| `/.well-known/oauth-authorization-server` | Advertises the endpoints below |
| `/register` | Dynamic client registration → `{AUTH}/api/v2/auth?action=oauth_register_app` |
| `/authorize` | 302 → `{AUTH}/authorize` (adds `resource=/mcp`) |
| `/token` | → `{AUTH}/api/v2/auth?action=oauth_token` (`authorization_code`, `refresh_token`) |

Access tokens are validated on every `/mcp` call through the same `validateToken`. Non-admins get 403 with `WWW-Authenticate: Bearer error="insufficient_scope"`.

Direct API access also works with `Authorization: Bearer <materio token>`. The plugin config is in `plugin/.mcp.json`.

> Note: Materio ID advertises `/account/sso` as its authorization endpoint, which currently 404s (the real page is `/authorize`). This app doesn't rely on that metadata.
