# API Contracts: Supabase Authentication System

**Feature**: 002-supabase-auth  
**Date**: 27 November 2025  
**Status**: Complete

## Overview

This document defines the API contracts for the authentication system. All endpoints use SvelteKit form actions (server-side) for security. Client-side operations use the Supabase browser client directly.

## Form Actions

### POST /signup (Form Action)

**Description**: Register a new user account

**Request Body** (FormData):
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| email | string | Yes | Valid email format |
| password | string | Yes | Minimum 8 characters |
| username | string | Yes | 3-30 chars, alphanumeric + underscore |

**Success Response** (302 Redirect):

- Redirect to: `/` (homepage) or `?redirect` query param value
- Session cookie set automatically

**Error Response** (200 with form data):

```typescript
{
  success: false,
  error: string,        // User-friendly error message
  email?: string,       // Preserve form values
  username?: string
}
```

**Error Codes**:
| Code | Message |
|------|---------|
| email_exists | "An account with this email already exists" |
| username_exists | "This username is already taken" |
| weak_password | "Password must be at least 8 characters" |
| invalid_email | "Please enter a valid email address" |
| invalid_username | "Username must be 3-30 characters (letters, numbers, underscore)" |

---

### POST /login (Form Action)

**Description**: Authenticate an existing user

**Request Body** (FormData):
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| email | string | Yes | Valid email format |
| password | string | Yes | Non-empty |

**Success Response** (302 Redirect):

- Redirect to: `/` (homepage) or `?redirect` query param value
- Session cookie set automatically

**Error Response** (200 with form data):

```typescript
{
  success: false,
  error: string,
  email?: string
}
```

**Error Codes**:
| Code | Message |
|------|---------|
| invalid_credentials | "Invalid email or password" |
| user_not_found | "No account found with this email" |

---

### POST /profile?/update (Form Action)

**Description**: Update user's username

**Authentication**: Required (redirects to /login if not authenticated)

**Request Body** (FormData):
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| username | string | Yes | 3-30 chars, alphanumeric + underscore |

**Success Response** (200):

```typescript
{
  success: true,
  message: "Profile updated successfully",
  username: string
}
```

**Error Response** (200 with form data):

```typescript
{
  success: false,
  error: string,
  username?: string
}
```

**Error Codes**:
| Code | Message |
|------|---------|
| username_exists | "This username is already taken" |
| invalid_username | "Username must be 3-30 characters (letters, numbers, underscore)" |
| unauthorized | "You must be logged in to update your profile" |

---

### POST /profile?/changePassword (Form Action)

**Description**: Change user's password

**Authentication**: Required (redirects to /login if not authenticated)

**Request Body** (FormData):
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| currentPassword | string | Yes | Non-empty |
| newPassword | string | Yes | Minimum 8 characters |
| confirmPassword | string | Yes | Must match newPassword |

**Success Response** (200):

```typescript
{
  success: true,
  message: "Password changed successfully"
}
```

**Error Response** (200 with form data):

```typescript
{
  success: false,
  error: string
}
```

**Error Codes**:
| Code | Message |
|------|---------|
| invalid_current_password | "Current password is incorrect" |
| weak_password | "New password must be at least 8 characters" |
| password_mismatch | "New passwords do not match" |
| unauthorized | "You must be logged in to change your password" |

---

### POST /profile?/signout (Form Action)

**Description**: Sign out the current user

**Authentication**: Required

**Request Body**: None

**Success Response** (302 Redirect):

- Redirect to: `/login`
- Session cookie cleared

---

## Page Load Functions

### GET / (Layout Load)

**Description**: Load session data for all pages

**Response** (PageData):

```typescript
{
  session: Session | null,
  user: User | null
}
```

---

### GET /profile (Page Load)

**Description**: Load profile data for authenticated user

**Authentication**: Required (redirects to /login if not authenticated)

**Response** (PageData):

```typescript
{
  session: Session,
  user: User,
  profile: {
    id: string,
    username: string,
    created_at: string,
    updated_at: string
  }
}
```

---

## Client-Side Operations

### Auth State Subscription

```typescript
// Browser client listens for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
	// Events: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED'
});
```

### Session Refresh

```typescript
// Automatic via @supabase/ssr cookie handling
// Manual refresh if needed:
await supabase.auth.refreshSession();
```

---

## HTTP Status Codes

| Code | Usage                                         |
| ---- | --------------------------------------------- |
| 200  | Form action processed (check `success` field) |
| 302  | Redirect after successful action              |
| 303  | Redirect after POST (SvelteKit default)       |
| 401  | Unauthorized (handled via redirect to /login) |
| 500  | Server error (shown as generic error message) |

---

## Security Considerations

1. **CSRF Protection**: SvelteKit form actions include CSRF tokens automatically
2. **Password Hashing**: Handled by Supabase Auth (bcrypt)
3. **Session Storage**: HTTP-only cookies via `@supabase/ssr`
4. **Rate Limiting**: Handled by Supabase Auth service
5. **Input Validation**: Both client-side (HTML5 + Svelte) and server-side
