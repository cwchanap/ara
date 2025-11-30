# Quickstart: Authentication System

**Feature**: 002-supabase-auth  
**Date**: 27 November 2025

## Architecture Overview

This authentication system uses a **split architecture**:

- **Supabase Auth**: Handles authentication only (login, signup, sessions, password management)
- **Neon PostgreSQL**: Stores application data (profiles table, and all future app data)

## Prerequisites

1. **Supabase Project**: Create a project at [supabase.com](https://supabase.com)
2. **Neon PostgreSQL**: Create a project at [neon.tech](https://neon.tech)
3. **Node.js**: v18+ installed
4. **Existing Ara project**: Clone and set up the base project

## Setup Steps

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

### 2. Configure Environment Variables

Create/update `.env` file:

```env
# Supabase (Authentication Only)
PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Neon PostgreSQL (Application Database)
DATABASE_URL=postgresql://username:password@host/database?sslmode=require
```

> - Supabase values: Dashboard → Settings → API
> - Neon value: Dashboard → Connection Details → Connection string (pooled)

### 3. Configure Supabase Dashboard

**⚠️ CRITICAL: Complete these steps BEFORE testing the application!**

1. **Disable email confirmation** (required for FR-002):
   - Dashboard → Authentication → Providers → Email
   - Toggle OFF "Confirm email"
   - Click "Save"

2. **Set password requirements**:
   - Dashboard → Authentication → Providers → Email
   - Ensure "Enable Email Provider" is ON
   - Minimum password length: 8

3. **Verify Site URL**:
   - Dashboard → Authentication → URL Configuration
   - Site URL: `http://localhost:5173` (for development)
   - Add redirect URLs if needed

### 4. Create Database Schema in Neon

**Option A: Using SQL Editor (Neon Console)**

1. Go to Neon Console → SQL Editor
2. Open and copy contents from `specs/002-supabase-auth/migration.sql`
3. Click "Run"
4. Verify: Tables tab should show `profiles` table

**Option B: Using Drizzle Kit (Recommended for ongoing development)**

```bash
# Push schema to database
npx drizzle-kit push

# Or generate and run migrations
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 5. Run Development Server

```bash
npm run dev
```

### 6. Test Authentication Flow

1. Navigate to `http://localhost:5173/signup`
2. Create an account with email, username, and password
3. Verify automatic redirect to homepage
4. Navigate to `/profile` to see your profile
5. Test logout functionality

## File Structure Overview

After implementation, you'll have:

```
src/
├── app.d.ts                    # Type declarations
├── hooks.server.ts             # Supabase server client setup
├── lib/
│   ├── supabase.ts             # Browser client factory
│   ├── auth-errors.ts          # Error message mapping
│   └── server/
│       └── db/
│           ├── index.ts        # Neon/Drizzle connection
│           └── schema.ts       # Database schema (profiles table)
├── routes/
│   ├── +layout.svelte          # Global layout with auth nav
│   ├── +layout.server.ts       # Session loader
│   ├── login/+page.svelte      # Login form
│   ├── login/+page.server.ts   # Login action
│   ├── signup/+page.svelte     # Signup form
│   ├── signup/+page.server.ts  # Signup action + create profile in Neon
│   ├── profile/+page.svelte    # Profile page
│   └── profile/+page.server.ts # Profile actions (update, changePassword, signout)
drizzle.config.ts               # Drizzle Kit configuration
```

## How It Works

1. **Signup**: User submits form → Supabase creates auth user → App creates profile in Neon DB
2. **Login**: User submits form → Supabase verifies credentials → Session cookie set
3. **Profile Load**: App fetches profile from Neon DB using Supabase user ID
4. **Profile Update**: App updates Neon DB directly (username)
5. **Password Change**: App calls Supabase Auth API
6. **Logout**: App calls Supabase Auth signOut → Session cleared

## Common Issues

### "Invalid API key"

- Verify `PUBLIC_SUPABASE_ANON_KEY` is correct
- Check for trailing spaces in `.env`

### "User already registered"

- Email confirmation might still be enabled
- Check Supabase Dashboard → Authentication → Settings

### "Error creating profile in Neon DB"

- Verify `DATABASE_URL` is correct
- Check Neon project is active (not hibernating)
- Ensure migration has been run

### Session not persisting

- Ensure `@supabase/ssr` is correctly configured in `hooks.server.ts`
- Check that cookies are being set (check browser dev tools)

### Profile not found after signup

- Check Neon database for the profile record
- Verify user ID matches between Supabase and Neon

## Testing Checklist

- [ ] Can create new account with email/password/username
- [ ] Can log in with existing credentials
- [ ] Can view profile page when logged in
- [ ] Can update username
- [ ] Can change password
- [ ] Can log out
- [ ] Redirected to login when accessing /profile while logged out
- [ ] Redirected to homepage when accessing /login while logged in
