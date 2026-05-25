# Neon Google Auth Clean Cutover Design

## Context

Ara currently uses Supabase Auth for email/password sessions and Neon PostgreSQL with
Drizzle for application data. The requested change is a clean cutover to Google-only
sign-in/sign-up with Neon Auth. Existing Supabase users and saved configuration
ownership do not need to be migrated.

Reference docs checked during design:

- Neon OAuth setup: https://neon.com/docs/auth/guides/setup-oauth
- Neon Auth flow: https://neon.com/docs/auth/authentication-flow
- Neon Supabase migration guide: https://neon.com/docs/auth/migrate/from-supabase

## Goals

- Remove the current password login and signup flow.
- Remove Supabase as the authentication provider.
- Use Google as the only user-facing sign-in and sign-up method through Neon Auth.
- Keep Neon PostgreSQL and Drizzle as the application data layer.
- Preserve the existing protected-route behavior for profiles, saved configs, and
  share creation.
- Auto-create a profile username for first-time Google users, then let users edit it.

## Non-Goals

- Migrating Supabase users into Neon Auth.
- Migrating saved configurations from Supabase user IDs to Neon Auth user IDs.
- Adding other OAuth providers.
- Adding password, magic-link, or email-code authentication.
- Reworking saved-config storage around Neon Data API or RLS in this slice.

## Architecture

The app should keep the current SvelteKit server boundary but replace the identity
provider behind it.

- `src/hooks.server.ts` creates the Neon Auth-backed server auth client and exposes
  `locals.safeGetSession()`.
- `src/routes/+layout.server.ts` continues to return `{ session, user }`.
- Protected pages and APIs continue to call `locals.safeGetSession()`.
- `profiles.id`, `saved_configurations.user_id`, and `shared_configurations.user_id`
  remain UUID ownership keys, now sourced from Neon Auth user IDs.
- Supabase-specific browser and server clients are removed.

The implementation should use the official Neon Auth SDK/API path that supports
SvelteKit cookie-based sessions. If the final Neon package shape differs between
Neon JS and Neon Auth SDK docs, the implementation plan should first pin the exact
official API, then keep this same SvelteKit boundary.

## Environment

Remove Supabase auth environment requirements from app code and docs:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Add Neon Auth environment requirements based on the official SDK selected during
implementation. The expected server-side requirements are a Neon Auth base URL and
a cookie/session secret. Public client-side configuration should be limited to the
minimum value required to initiate the Google OAuth flow.

## Routes And UI

`/login` becomes the single authentication entry page. It renders the existing
sci-fi themed card with one primary Google CTA. It preserves safe relative
`redirect` parameters and starts the Neon Auth Google OAuth flow.

`/signup` no longer renders a signup form. It redirects to `/login`, preserving a
safe `redirect` parameter when present.

`/profile` keeps:

- read-only account identity display,
- username edit form,
- existing username validation.

`/profile` removes:

- current password field,
- new password field,
- confirm password field,
- password update action,
- password success/warning/error UI.

The top nav changes unauthenticated links from `Login` plus `Sign Up` to one
`Sign In` link. Authenticated users keep `My Configs`, `Profile`, and `Logout`.

## Profile Provisioning

First-time Google users get a `profiles` row automatically after a valid Neon Auth
session is observed.

The helper should:

1. Return the existing profile when present.
2. Derive a base username from Google profile name when available, otherwise the
   email local part.
3. Sanitize the base username to the existing username rules.
4. Fall back to `chaos_user` if the derived value cannot produce a valid username.
5. Insert the profile with the Neon Auth user ID.
6. Retry with short deterministic or random suffixes on uniqueness collision.
7. Never overwrite an existing username.

Profile auto-provisioning should happen before any authenticated server path needs
a referenced profile row. That includes `/profile` and share creation because
`shared_configurations.user_id` references `profiles.id`. Saved config APIs can
rely on ownership by authenticated user ID and do not need profile display data,
but they may use the same helper if keeping all authenticated writes consistent is
simpler.

## Data Ownership

Saved and shared configurations created after the cutover are owned by the Neon Auth
user ID. Because this is a clean cutover, rows tied to old Supabase user IDs may be
left inaccessible or cleared separately outside this implementation.

The schema can keep UUID primary and foreign keys if Neon Auth user IDs are UUIDs.
If Neon Auth user IDs are not UUIDs in the selected SDK, the implementation must add
a focused schema migration for `profiles.id`, `saved_configurations.user_id`, and
`shared_configurations.user_id` rather than coercing IDs unsafely.

## Error Handling

- OAuth start or callback failure returns the user to `/login` with a concise error.
- Invalid or unsafe `redirect` values fall back to the app base path.
- Missing Neon Auth environment fails fast during server setup.
- Profile provisioning retries bounded username collisions, then returns a clear
  profile setup error.
- Sign-out logs provider errors but redirects to `/login` after clearing what local
  session state can be cleared.
- User-facing unauthenticated messages use `sign in` wording instead of `log in`
  where copy is touched.

## Testing

Update existing auth tests rather than adding a broad E2E suite first.

- Login server/page tests cover authenticated redirect, safe redirect preservation,
  one Google-only CTA, and error display.
- Signup tests cover redirect to `/login` while preserving safe redirects.
- Profile server/page tests cover username update, missing profile provisioning, and
  absence of password-change action and UI.
- Layout tests cover Neon Auth session data and one unauthenticated `Sign In` link.
- Protected API/page tests keep unauthenticated rejection and ownership checks.
- Supabase admin/client tests are removed or replaced by Neon Auth adapter tests.

Full verification commands:

- `bun test`
- `bun run test:unit`
- `bun run check`
- `bun run build`

## Rollout Notes

This is intentionally a clean cutover. Production deployment must configure the
Google OAuth provider and callback domains in Neon Auth before release. Local
development requires the corresponding local callback URL to be trusted by Neon
Auth. Existing Supabase Auth configuration can be removed after the Neon Auth flow
is verified locally and in the deployed environment.
