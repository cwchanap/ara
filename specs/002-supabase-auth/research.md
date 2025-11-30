# Research: Supabase Authentication System

**Feature**: 002-supabase-auth  
**Date**: 27 November 2025  
**Status**: Complete

## Research Tasks

### 1. Supabase Auth + SvelteKit Integration Pattern

**Decision**: Use `@supabase/ssr` package with cookie-based session management

**Rationale**:

- Official Supabase SSR package provides `createServerClient` and `createBrowserClient` functions
- Cookie-based auth is required for SSR to work correctly (JWT tokens stored in cookies)
- Server hooks (`hooks.server.ts`) initialize the Supabase client and attach to `event.locals`
- `safeGetSession()` pattern validates JWT by calling `getUser()` on the auth server

**Alternatives considered**:

- `@supabase/supabase-js` alone: Doesn't handle SSR cookie management properly
- Local storage auth: Doesn't work with SSR, causes hydration mismatches

**Implementation pattern**:

```typescript
// hooks.server.ts
event.locals.supabase = createServerClient(URL, KEY, {
	cookies: {
		getAll: () => event.cookies.getAll(),
		setAll: (cookiesToSet) => {
			cookiesToSet.forEach(({ name, value, options }) => {
				event.cookies.set(name, value, { ...options, path: '/' });
			});
		}
	}
});
```

### 2. Username Storage Strategy

**Decision**: Create a `profiles` table in Supabase PostgreSQL with username field

**Rationale**:

- Supabase Auth stores user metadata (`user_metadata`) but it's not indexed for unique constraints
- A separate `profiles` table allows:
  - Unique constraint on `username` column
  - Efficient lookup by username
  - Row Level Security (RLS) for user-specific access
- Table linked to `auth.users` via foreign key on `id`

**Alternatives considered**:

- Store username in `user_metadata`: Cannot enforce uniqueness at database level
- Store in `app_metadata`: Reserved for server-side admin data, not user-editable

**Schema**:

```sql
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. Password Change Without Re-authentication

**Decision**: Use Supabase `updateUser({ password: newPassword })` API

**Rationale**:

- Supabase Auth's `updateUser` method can update password directly for authenticated users
- The current session's JWT is sufficient authorization
- For extra security, we'll verify the current password first by attempting `signInWithPassword`

**Alternatives considered**:

- Password reset via email: User explicitly asked for no email verification
- Direct database update: Not possible, passwords are hashed by Auth service

**Implementation pattern**:

```typescript
// Verify current password first
const { error: verifyError } = await supabase.auth.signInWithPassword({
	email: user.email,
	password: currentPassword
});
if (verifyError) throw new Error('Current password is incorrect');

// Update to new password
const { error } = await supabase.auth.updateUser({ password: newPassword });
```

### 4. Disabling Email Verification

**Decision**: Configure Supabase project settings + use `autoconfirm` option

**Rationale**:

- Supabase dashboard: Authentication → Settings → Disable "Enable email confirmations"
- Alternatively, use environment variable `GOTRUE_MAILER_AUTOCONFIRM=true`
- Users are immediately authenticated after signup without email confirmation step

**Alternatives considered**:

- Custom signup flow with manual confirmation: Adds unnecessary complexity
- Magic link only: User specifically requested email + password auth

### 5. Session Expiry Handling

**Decision**: Use `onAuthStateChange` listener to detect session expiry and redirect

**Rationale**:

- Supabase client fires `SIGNED_OUT` event when session expires
- Browser client can listen and show notification before redirect
- Return URL stored in query param (`?redirect=/profile`) for post-login restoration

**Implementation pattern**:

```typescript
$effect(() => {
	const {
		data: { subscription }
	} = supabase.auth.onAuthStateChange((event) => {
		if (event === 'SIGNED_OUT') {
			// Show notification, store current URL, redirect to login
		}
	});
	return () => subscription.unsubscribe();
});
```

### 6. Form Validation Strategy

**Decision**: Client-side validation with HTML5 attributes + server-side validation in form actions

**Rationale**:

- HTML5 `required`, `minlength`, `pattern` for immediate feedback
- Svelte 5 `$state()` for dynamic validation messages
- Server actions validate again and return `fail()` with error messages
- Meets SC-003: 95% of validation errors caught client-side

**Validation rules**:

- Email: Valid email format (HTML5 `type="email"`)
- Password: Minimum 8 characters
- Username: 3-30 characters, alphanumeric + underscores (`^[a-zA-Z0-9_]{3,30}$`)

### 7. Error Message Mapping

**Decision**: Create error message mapping from Supabase error codes to user-friendly messages

**Rationale**:

- Supabase returns technical error codes like `user_already_exists`, `invalid_credentials`
- FR-015 requires user-friendly messages
- Centralized mapping ensures consistency

**Error mappings**:

```typescript
const errorMessages: Record<string, string> = {
	user_already_exists: 'An account with this email already exists',
	invalid_credentials: 'Invalid email or password',
	weak_password: 'Password must be at least 8 characters',
	email_not_confirmed: 'Please verify your email address',
	user_not_found: 'No account found with this email',
	default: 'Something went wrong. Please try again.'
};
```

## Environment Variables Required

```env
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Dependencies to Add

```json
{
	"dependencies": {
		"@supabase/supabase-js": "^2.x",
		"@supabase/ssr": "^0.x"
	}
}
```

## Supabase Project Configuration

1. **Disable email confirmation**: Dashboard → Authentication → Settings → Email → Disable "Enable email confirmations"
2. **Create profiles table**: Run SQL migration in Supabase SQL Editor
3. **Enable RLS**: Add policies for profiles table
4. **Set password requirements**: Dashboard → Authentication → Settings → Password minimum length: 8
