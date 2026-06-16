# Auth And Runtime Config

## Important Rule

MSAL auth configuration is created at runtime in deployed environments. Do not treat static repository values as production truth.

The checked-in Angular files are useful for local development and type shape, but future agents should verify the runtime generation/deployment path before changing auth settings or concluding an environment is misconfigured.

## Frontend MSAL Flow

Relevant files:

- `firewire-ui/src/app/auth/msal.config.ts`
- `firewire-ui/src/app/auth/auth.service.ts`
- `firewire-ui/src/app/auth/auth.interceptor.ts`
- `firewire-ui/src/environments/environment.ts`

Current Angular behavior:

- `msal.config.ts` builds a `PublicClientApplication`.
- `AuthService` initializes MSAL in an `APP_INITIALIZER`.
- Redirect responses set the active account.
- If there is no active account, the app starts `loginRedirect` unless it is in an iframe or a logged-out route.
- `auth.interceptor.ts` attaches bearer tokens to URLs starting with configured protected prefixes, currently `/api`.
- API tokens are acquired with configured API scopes.

## Backend Token Validation

Relevant file:

- `firewire-web/src/core/bootstrap.ts`

Backend behavior:

- `initializeTokenValidation()` reads tenant/audience settings from env.
- It loads OpenID metadata from Microsoft Entra.
- It loads JWKS signing keys.
- It accepts configured audiences plus `api://<primaryAudience>`.
- It accepts v2 and legacy issuer forms.
- It validates RS256/RS384/RS512 bearer tokens for all `/api/*` routes.
- It requires scopes or roles from `ENTRA_REQUIRED_SCOPES`, defaulting to `user_impersonation`.
- It stores the verified token output on the Express request as `bearerTokenOutput`.

Backend env names:

- `ENTRA_TENANT_ID`, legacy alias `FIREWIRETENANTID`
- `ENTRA_API_AUDIENCE`, legacy alias `FIREWIRECLIENTID`
- `ENTRA_REQUIRED_SCOPES`, default `user_impersonation`
- `FIREWIRESECRET` exists in the deployed environment inventory and should be treated as secret material. Verify its active code path before changing or removing it.

The current user-provided `firewire-web` environment inventory uses the legacy `FIREWIRETENANTID` and `FIREWIRECLIENTID` names. Backend code also supports the newer `ENTRA_*` names above.

## Runtime Config Guidance

For future auth work:

- Look for deployment scripts or hosting startup steps that generate an auth config file from `.env` or hosting environment variables.
- Do not hard-code tenant IDs, client IDs, authorities, scopes, or redirect URLs into production logic.
- Keep local defaults obviously local or development-only.
- If adding new frontend auth fields, update the runtime generation path as well as TypeScript environment shape.
- If changing API scopes, update both frontend API scopes and backend `ENTRA_REQUIRED_SCOPES`/audience expectations.

## User Preferences

MSAL authenticates the user. User-specific preferences are backed by SQL tables and Firewire user preference repository/API code. Do not conflate Entra identity with Firewire preference persistence.

Relevant files:

- `firewire-web/src/workspaces/firewire/data/firewire.user-preferences.data.ts`
- `firewire-web/src/workspaces/firewire/repository/firewireuserpreferences.repository.ts`
- `firewire-ui/src/app/common/services/user-preferences.service.ts`

## Common Auth Mistakes To Avoid

- Do not remove runtime config generation because static Angular config appears to work locally.
- Do not bypass `authInterceptor` with raw `fetch` for API calls that require auth.
- Do not add unauthenticated `/api/*` routes unless the global bootstrap auth behavior is intentionally changed.
- Do not log tokens, full claims, secrets, or client secrets.
- Do not assume `AuthStrategy.none` on manifests means routes are public.
