# Implementation Plan: Supabase Authentication System

**Branch**: `002-supabase-auth` | **Date**: 27 November 2025 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-supabase-auth/spec.md`

## Summary

Implement a complete authentication system using Supabase Auth for the Ara chaos visualization application. The system includes signup (no email verification), login, profile management (view/edit username, change password), and logout functionality. Uses Supabase SSR package for server-side session handling in SvelteKit with cookie-based authentication.

## Technical Context

**Language/Version**: TypeScript 5.9+ (strict mode)  
**Framework**: SvelteKit 2.x with Svelte 5 (runes syntax)  
**Primary Dependencies**:

- `@supabase/supabase-js` - Supabase client
- `@supabase/ssr` - Server-side rendering support for cookie-based auth

**Storage**: Supabase PostgreSQL (hosted) with `profiles` table for username storage  
**Testing**: Manual testing (existing project has no test framework configured)  
**Target Platform**: Web (Netlify deployment via adapter-netlify)  
**Project Type**: Web application (SvelteKit)  
**Performance Goals**: Auth operations complete within 2 seconds (per SC-004)  
**Constraints**: Must use Svelte 5 runes syntax, sci-fi aesthetic, base path compliance  
**Scale/Scope**: Single-user sessions, ~10 active users initially

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                           | Status  | Notes                                                                                     |
| ----------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| I. Svelte 5 Runes Pattern           | ✅ PASS | Will use `$state()`, `$effect()`, `$props()` in all auth components                       |
| II. Visualization Library Selection | ✅ N/A  | Auth feature doesn't involve visualization rendering                                      |
| III. Cleanup Discipline             | ✅ PASS | Auth state subscriptions will be unsubscribed on component unmount                        |
| IV. Sci-Fi Aesthetic Consistency    | ✅ PASS | Login/signup/profile pages will use cyan primary, Orbitron/Rajdhani fonts, corner borders |
| V. Base Path Compliance             | ✅ PASS | All routes will use `{base}` from `$app/paths`                                            |

**Gate Result**: ✅ PASS - Proceed to Phase 0

### Post-Design Re-Check (Phase 1 Complete)

| Principle                           | Status  | Verification                                                            |
| ----------------------------------- | ------- | ----------------------------------------------------------------------- |
| I. Svelte 5 Runes Pattern           | ✅ PASS | data-model.md uses `$state()` patterns, contracts use reactive patterns |
| II. Visualization Library Selection | ✅ N/A  | No visualization components in auth feature                             |
| III. Cleanup Discipline             | ✅ PASS | research.md documents `onAuthStateChange` subscription cleanup pattern  |
| IV. Sci-Fi Aesthetic Consistency    | ✅ PASS | UI requirements in contracts specify cyan primary, Orbitron fonts       |
| V. Base Path Compliance             | ✅ PASS | All redirect paths in contracts use relative paths compatible with base |

**Post-Design Gate Result**: ✅ PASS - Ready for Phase 2 (tasks)

## Project Structure

### Documentation (this feature)

```text
specs/002-supabase-auth/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── auth-api.md      # API contract definitions
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app.d.ts                    # TypeScript declarations for locals
├── hooks.server.ts             # NEW: Supabase server client + session handling
├── lib/
│   ├── supabase.ts             # NEW: Browser client factory
│   └── auth-errors.ts          # NEW: Error message mapping utility
├── routes/
│   ├── +layout.svelte          # MODIFY: Add auth state, nav links
│   ├── +layout.server.ts       # NEW: Load session for all routes
│   ├── login/
│   │   ├── +page.svelte        # NEW: Login form UI
│   │   └── +page.server.ts     # NEW: Login form action
│   ├── signup/
│   │   ├── +page.svelte        # NEW: Signup form UI
│   │   └── +page.server.ts     # NEW: Signup form action
│   └── profile/
│       ├── +page.svelte        # NEW: Profile view/edit UI
│       └── +page.server.ts     # NEW: Profile load/update/password/signout actions
```

**Structure Decision**: Single web application following existing SvelteKit conventions. Auth routes added alongside existing visualization routes. Server-side actions handle form submissions for security.

## Complexity Tracking

No constitution violations requiring justification.
