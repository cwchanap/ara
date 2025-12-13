# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a SvelteKit-based interactive web application that visualizes 8 different chaos theory mathematical systems. The project reproduces Python-based chaos visualizations using modern web technologies, featuring real-time parameter manipulation and beautiful sci-fi themed UI.

## Development Commands

### Development Server

```bash
bun run dev                 # Start dev server
bun run dev -- --open       # Start and open in browser (http://localhost:5173)
```

### Build & Preview

```bash
bun run build              # Build for production
bun run preview            # Preview production build
```

### Code Quality & Testing

```bash
bun run check              # Run svelte-check for type errors
bun run check:watch        # Run svelte-check in watch mode
bun run lint               # Run ESLint and Prettier checks
bun run format             # Format all files with Prettier
bun test                   # Run tests
```

Note: Pre-commit hooks automatically run linting and formatting via `lint-staged`.

### Database Management

```bash
# Generate SQL migration files from schema changes
bunx drizzle-kit generate

# Apply migrations to database (requires DATABASE_URL or NETLIFY_DATABASE_URL)
bunx drizzle-kit migrate

# Open Drizzle Studio to browse database
bunx drizzle-kit studio
```

**Environment variables required**:

- `PUBLIC_SUPABASE_URL`: Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous/public key
- `DATABASE_URL`: Neon PostgreSQL connection string (pooled connection recommended)
- `NETLIFY_DATABASE_URL`: Alternative to DATABASE_URL when deployed to Netlify

## Architecture

### Tech Stack

- **Runtime**: Bun (package manager and test runner)
- **Framework**: SvelteKit (Svelte 5 with runes)
- **Language**: TypeScript (strict mode enabled)
- **Styling**: TailwindCSS v4 with custom utility classes
- **Authentication**: Supabase Auth (email/password)
- **Database**: Neon PostgreSQL with Drizzle ORM
- **Visualizations**:
  - Three.js (3D - Lorenz attractor)
  - D3.js (2D plots - Hénon, Logistic, Standard maps)
  - Canvas API (fractals and bifurcation diagrams)
- **Deployment**: Netlify (adapter-netlify)

### Code Patterns

#### Svelte 5 Runes

This project uses Svelte 5's new runes syntax:

- `$state()` for reactive variables
- `$effect()` for reactive side effects (replaces `$:` reactive statements)
- `$props()` for component props

#### Reactive Parameter Updates

All visualization pages follow this pattern:

```typescript
let param = $state(initialValue);

$effect(() => {
	void param; // Track dependency
	if (recreate) recreate();
});
```

#### Three.js Setup (Lorenz)

- Scene background is `null` (transparent) to show CSS background
- Uses OrbitControls with auto-rotation
- Cleanup: dispose renderer, remove event listeners, set `isAnimating = false`

#### D3.js Visualizations (Hénon, Logistic, Standard)

- Manual clearing: `d3.select(container).selectAll('*').remove()`
- Sci-fi styled axes with cyan colors (`#00f3ff`)
- Gradient color schemes (cyan to magenta)

#### Canvas Rendering (Bifurcation, Newton)

- Use `isRendering` flag to prevent concurrent renders
- Direct pixel manipulation with `fillRect()`
- Performance optimization via density limiting

#### Web Workers

`src/lib/workers/chaosMapsWorker.ts` handles heavy computations for Standard Map and Chaos Esthetique visualizations to prevent UI blocking.

#### Authentication & Authorization

The app uses a **dual-database architecture**:

- **Supabase**: Handles authentication only (JWT sessions, email/password)
- **Neon PostgreSQL**: Stores application data (user profiles)

**Key components**:

- `src/hooks.server.ts`: Creates Supabase client in `event.locals.supabase` and provides `event.locals.safeGetSession()` which validates JWT tokens by calling `getUser()` (not just `getSession()`)
- `src/app.d.ts`: Type definitions for `App.Locals` (Supabase client and safeGetSession) and `App.PageData` (session, user, profile)
- `src/lib/server/db/`: Drizzle ORM setup with schema and database connection
- `src/lib/server/db/schema.ts`: Profiles table with `id` (UUID from Supabase auth.users), `username`, timestamps

**Authentication pattern**:

```typescript
// In +page.server.ts load functions
export const load: PageServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();
	// Redirect if not authenticated, or fetch user data from Neon
};
```

**Database operations**:

```typescript
import { db, profiles } from '$lib/server/db';
import { eq } from 'drizzle-orm';

// Query profile by Supabase user ID
const profile = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
```

**Profile management**: Uses upsert pattern in `src/routes/profile/+page.server.ts` to handle missing profiles (update first, then insert if no rows affected).

### File Structure

```
src/
├── routes/
│   ├── +layout.server.ts           # Load session/user for all routes
│   ├── +layout.svelte              # App layout with nav & background
│   ├── +page.svelte                # Homepage with visualization cards
│   ├── login/+page.server.ts       # Login form action
│   ├── signup/+page.server.ts      # Signup form action
│   ├── profile/+page.server.ts     # Profile management (username, password)
│   ├── lorenz/+page.svelte         # Three.js 3D visualization
│   ├── henon/+page.svelte          # D3.js 2D plot
│   ├── logistic/+page.svelte       # D3.js line chart
│   ├── bifurcation-logistic/       # Canvas bifurcation
│   ├── bifurcation-henon/          # Canvas bifurcation
│   ├── newton/+page.svelte         # Canvas fractal
│   ├── standard/+page.svelte       # D3.js with web worker
│   └── chaos-esthetique/           # Canvas with web worker
├── lib/
│   ├── server/
│   │   ├── db/
│   │   │   ├── index.ts            # Drizzle database instance
│   │   │   └── schema.ts           # Database schema (profiles table)
│   │   └── supabase-admin.ts       # Admin Supabase client
│   ├── workers/                    # Web workers for heavy computation
│   ├── supabase.ts                 # Browser Supabase client factory
│   ├── auth-errors.ts              # Auth validation utilities
│   ├── types.ts                    # Shared TypeScript types
│   └── utils.ts                    # Utility functions
├── hooks.server.ts                 # Supabase client setup & safeGetSession
└── app.d.ts                        # App-wide type definitions
```

### Styling Conventions

The app uses a **sci-fi chaos theory aesthetic**:

- Primary color: Neon cyan (`#00f3ff`)
- Accent: Magenta/purple
- Font: "Orbitron" (headings), "Rajdhani" (body)
- Naming: UPPERCASE_SNAKE_CASE for titles (e.g., "LORENZ_ATTRACTOR")
- UI elements: Corner borders, glowing effects, backdrop blur, tech grid background

### Important Configuration

**Base Path Handling**: All routes use `{base}` from `$app/paths` for proper deployment on non-root paths.

**Vite Config**: The `chaos/` directory (Python reference scripts) is ignored in watch mode.

**TypeScript**: Strict mode enabled. Path aliases managed by SvelteKit.

**Deployment**: Uses Netlify adapter with Neon PostgreSQL integration. Both `DATABASE_URL` and `NETLIFY_DATABASE_URL` are supported for database connections.

## Common Development Tasks

### Adding a New Visualization

1. Create route: `src/routes/visualization-name/+page.svelte`
2. Choose rendering library (Three.js, D3.js, or Canvas)
3. Follow existing patterns for reactive parameters with `$state()` and `$effect()`
4. Add to `visualizations` array in `src/routes/+page.svelte`
5. Include sci-fi themed UI (corner borders, cyan colors, Orbitron font)
6. Add mathematical formula display in control panel

### Performance Considerations

- **Bifurcation diagrams**: Limit iterations and image resolution for responsiveness
- **Heavy computations**: Use web workers (see `chaosMapsWorker.ts`)
- **Canvas operations**: Use `isRendering` flags to prevent concurrent renders
- **D3 cleanup**: Always clear previous elements before re-rendering

### Debugging Visualizations

- Check browser console for mathematical errors (NaN, Infinity)
- Verify parameter ranges produce valid results
- Test cleanup on component unmount (memory leaks)
- Confirm reactive updates trigger re-renders correctly

### Working with Authentication

**Protected routes**: Use `locals.safeGetSession()` in load functions and redirect if unauthenticated:

```typescript
export const load: PageServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		throw redirect(303, `${base}/login?redirect=${encodeURIComponent(url.pathname)}`);
	}
	// ... fetch user data
};
```

**Form actions**: Always validate inputs using `$lib/auth-errors.ts` utilities (`validateUsername`, `validatePassword`, `getErrorMessage`).

**Password changes**: Use the pattern in `src/routes/profile/+page.server.ts` which verifies current password via `signInWithPassword` before updating (Supabase has no verify-only API).

## Active Technologies

- TypeScript 5.x with Svelte 5 (runes syntax) + SvelteKit, Drizzle ORM, Supabase Auth, D3.js, Three.js, TailwindCSS v4 (001-save-chaos-map)
- Neon PostgreSQL (via Drizzle ORM) for application data, Supabase for auth (001-save-chaos-map)

## Recent Changes

- 001-save-chaos-map: Implemented "Save Chaos Map Configuration" feature:
  - Database: `saved_configurations` table with JSONB parameters storage
  - Save: Users can save configurations with custom names from any chaos map page
  - View: `/saved-configs` page lists all saved configurations with map type badges
  - Load: Click-to-load navigates to chaos map with parameters applied via URL query params
  - Delete: Confirmation dialog before deletion with ownership verification
  - Rename: Inline rename UI with validation (1-100 chars)
  - Stability: Parameter validation warns users when loading potentially unstable configurations
  - Components: `SaveConfigDialog`, `DeleteConfirmDialog` using native `<dialog>` element
  - API: `/api/save-config` POST endpoint for cross-page saving
  - Auth: Redirects unauthenticated users to login with return URL
