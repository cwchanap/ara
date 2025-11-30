# Data Model: Supabase Authentication System

**Feature**: 002-supabase-auth  
**Date**: 27 November 2025  
**Status**: Complete

## Entities

### 1. User (Supabase Auth)

**Source**: Supabase `auth.users` table (managed by Supabase Auth)

| Field              | Type      | Constraints      | Description                                |
| ------------------ | --------- | ---------------- | ------------------------------------------ |
| id                 | UUID      | PK               | Unique user identifier                     |
| email              | string    | UNIQUE, NOT NULL | User's email address (login identifier)    |
| encrypted_password | string    | NOT NULL         | Bcrypt-hashed password                     |
| email_confirmed_at | timestamp | -                | When email was confirmed (null if pending) |
| created_at         | timestamp | NOT NULL         | Account creation timestamp                 |
| updated_at         | timestamp | NOT NULL         | Last update timestamp                      |
| user_metadata      | jsonb     | -                | User-editable metadata                     |

**Note**: This table is managed by Supabase Auth. We don't modify it directly.

### 2. Profile

**Source**: `public.profiles` table (custom table)

| Field      | Type      | Constraints                  | Description                 |
| ---------- | --------- | ---------------------------- | --------------------------- |
| id         | UUID      | PK, FK → auth.users(id)      | Links to Supabase Auth user |
| username   | string    | UNIQUE, NOT NULL, 3-30 chars | User's display name         |
| created_at | timestamp | NOT NULL, DEFAULT NOW()      | Profile creation timestamp  |
| updated_at | timestamp | NOT NULL, DEFAULT NOW()      | Last update timestamp       |

**Relationships**:

- `id` → `auth.users(id)` (1:1, CASCADE DELETE)

**Validation Rules**:

- `username`: 3-30 characters, alphanumeric and underscores only (`^[a-zA-Z0-9_]{3,30}$`)
- `username`: Must be unique (enforced at database level)

### 3. Session (Supabase Auth)

**Source**: Supabase session object (in-memory/cookies)

| Field         | Type   | Description                                |
| ------------- | ------ | ------------------------------------------ |
| access_token  | string | JWT for API authentication                 |
| refresh_token | string | Token for refreshing expired access tokens |
| expires_at    | number | Unix timestamp when access token expires   |
| expires_in    | number | Seconds until expiration                   |
| user          | User   | Associated user object                     |

**Note**: Sessions are managed by Supabase Auth client. Stored in HTTP-only cookies via `@supabase/ssr`.

## Database Schema (SQL)

```sql
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL CHECK (
    length(username) >= 3 AND
    length(username) <= 30 AND
    username ~ '^[a-zA-Z0-9_]+$'
  ),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update updated_at on profile changes
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function: Create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

## State Transitions

### User Registration Flow

```
[Visitor] → signUp(email, password, username) → [Authenticated User]
                                                      ↓
                                               Profile created (trigger)
```

### Login Flow

```
[Visitor] → signInWithPassword(email, password) → [Authenticated User]
                                                        ↓
                                                  Session created
```

### Password Change Flow

```
[Authenticated] → verifyCurrentPassword() → updateUser(newPassword) → [Authenticated]
       ↓ (fail)                                    ↓ (fail)
   Error: Invalid current password            Error: Weak password
```

### Session Expiry Flow

```
[Authenticated] → session expires → SIGNED_OUT event → [Visitor]
                                          ↓
                                   Show notification
                                   Redirect to /login?redirect=<current-path>
```

## TypeScript Types

```typescript
// src/app.d.ts
import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
		}
		interface PageData {
			session: Session | null;
			user: User | null;
			profile: Profile | null;
		}
	}
}

// Profile type
interface Profile {
	id: string;
	username: string;
	created_at: string;
	updated_at: string;
}

// Form data types
interface SignupFormData {
	email: string;
	password: string;
	username: string;
}

interface LoginFormData {
	email: string;
	password: string;
}

interface ProfileUpdateFormData {
	username: string;
}

interface PasswordChangeFormData {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
}
```
