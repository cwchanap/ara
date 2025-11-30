# Tasks: Supabase Authentication System

**Input**: Design documents from `/specs/002-supabase-auth/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Not requested - manual testing only (per plan.md)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Supabase configuration

- [x] T001 Install Supabase dependencies: `npm install @supabase/supabase-js @supabase/ssr`
- [x] T002 [P] Create environment variables file `.env` with PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY placeholders
- [x] T003 [P] Update TypeScript declarations for Supabase locals in `src/app.d.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Supabase infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create Supabase server client with cookie handling in `src/hooks.server.ts`
- [x] T005 Create Supabase browser client factory in `src/lib/supabase.ts`
- [x] T006 [P] Create error message mapping utility in `src/lib/auth-errors.ts`
- [x] T007 Create root layout server load function for session in `src/routes/+layout.server.ts`
- [x] T008 Modify root layout to pass session data to children in `src/routes/+layout.svelte`
- [x] T009 [P] Update `specs/002-supabase-auth/quickstart.md` with Supabase dashboard configuration steps (disable email verification)
- [x] T010 Create SQL migration script for profiles table with RLS policies (to run in Supabase SQL Editor)

**Checkpoint**: Foundation ready - Supabase client available in all routes, session data loading

---

## Phase 3: User Story 1 - User Registration (Priority: P1) 🎯 MVP

**Goal**: New users can create accounts with email, username, and password (no email verification)

**Independent Test**: Navigate to /signup, fill form, verify automatic login and redirect to homepage

### Implementation for User Story 1

- [x] T011 [P] [US1] Create signup page UI with sci-fi styling in `src/routes/signup/+page.svelte`
- [x] T012 [US1] Implement signup form action with validation in `src/routes/signup/+page.server.ts`
- [x] T013 [US1] Add client-side form validation (email, password 8+ chars, username 3-30 chars) in `src/routes/signup/+page.svelte`
- [x] T014 [US1] Handle duplicate email error with user-friendly message in signup action
- [x] T015 [US1] Handle duplicate username error with user-friendly message in signup action
- [x] T016 [US1] Implement redirect to homepage (or return URL) after successful signup
- [x] T017 [US1] Add loading state and disabled submit during form processing

**Checkpoint**: Users can register new accounts, are auto-logged-in, and redirected

---

## Phase 4: User Story 2 - User Login (Priority: P1) 🎯 MVP

**Goal**: Returning users can log in with email and password

**Independent Test**: Navigate to /login with existing account, enter credentials, verify redirect and session

### Implementation for User Story 2

- [x] T018 [P] [US2] Create login page UI with sci-fi styling in `src/routes/login/+page.svelte`
- [x] T019 [US2] Implement login form action with validation in `src/routes/login/+page.server.ts`
- [x] T020 [US2] Add client-side form validation (email format, password required) in `src/routes/login/+page.svelte`
- [x] T021 [US2] Handle invalid credentials error with user-friendly message
- [x] T022 [US2] Implement redirect to homepage (or return URL from query param) after successful login
- [x] T023 [US2] Redirect authenticated users away from login page to homepage
- [x] T024 [US2] Add "Don't have an account? Sign up" link to login page
- [x] T025 [US2] Add loading state and disabled submit during form processing

**Checkpoint**: Users can log in, sessions persist, authenticated users redirected from login page

---

## Phase 5: User Story 3 - View and Edit Profile (Priority: P2)

**Goal**: Authenticated users can view email, view/edit username

**Independent Test**: Log in, navigate to /profile, view info, update username, verify change persists

### Implementation for User Story 3

- [x] T026 [P] [US3] Create profile page UI with sci-fi styling in `src/routes/profile/+page.svelte`
- [x] T027 [US3] Implement profile page server load with auth guard in `src/routes/profile/+page.server.ts`
- [x] T028 [US3] Redirect unauthenticated users to /login with return URL parameter
- [x] T029 [US3] Display email (read-only) and username (editable) fields
- [x] T030 [US3] Implement username update form action in `src/routes/profile/+page.server.ts`
- [x] T031 [US3] Add client-side username validation (3-30 chars, alphanumeric + underscore)
- [x] T032 [US3] Handle duplicate username error with user-friendly message
- [x] T033 [US3] Show success notification after profile update (without page refresh per SC-006)

**Checkpoint**: Users can view and update their profile username

---

## Phase 6: User Story 4 - Change Password (Priority: P2)

**Goal**: Authenticated users can change their password by providing current password

**Independent Test**: Log in, navigate to profile, change password, log out, log in with new password

### Implementation for User Story 4

- [x] T034 [US4] Add change password form section to profile page in `src/routes/profile/+page.svelte`
- [x] T035 [US4] Implement changePassword form action in `src/routes/profile/+page.server.ts`
- [x] T036 [US4] Verify current password before allowing change (signInWithPassword check)
- [x] T037 [US4] Validate new password meets requirements (8+ characters)
- [x] T038 [US4] Validate confirm password matches new password
- [x] T039 [US4] Handle incorrect current password error with user-friendly message
- [x] T040 [US4] Show success notification after password change

**Checkpoint**: Users can securely change their password

---

## Phase 7: User Story 5 - User Logout (Priority: P2)

**Goal**: Authenticated users can sign out and end their session

**Independent Test**: Log in, click logout, verify redirect to login and session cleared

### Implementation for User Story 5

- [x] T041 [US5] Add logout button to navigation in `src/routes/+layout.svelte` (POSTs to `/profile?/signout`)
- [x] T042 [US5] Implement signout form action in `src/routes/profile/+page.server.ts` (named action `?/signout`)
- [x] T043 [US5] Show login/signup links when logged out, profile/logout when logged in
- [x] T044 [US5] Redirect to login page after successful logout
- [x] T045 [US5] Clear session cookies on logout

**Checkpoint**: Users can log out, navigation reflects auth state

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Session handling, UX improvements, final integration

- [x] T046 [P] Add auth state change listener for session expiry detection in `src/routes/+layout.svelte`
- [x] T047 Show notification when session expires with "Try again" button
- [x] T048 [P] Preserve return URL when redirecting to login from protected routes
- [x] T049 [P] Add "Already have an account? Log in" link to signup page
- [x] T050 [P] Style all form error messages consistently with sci-fi theme
- [x] T051 [P] Add focus states and accessibility attributes to all form inputs
- [x] T052 Run `npm run check` to verify TypeScript types
- [x] T053 Run `npm run lint` to verify code style
- [ ] T054 Manual testing: Complete quickstart.md testing checklist

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational ←── BLOCKS all user stories
    ↓
┌───────────────────────────────────────────┐
│  User Stories can proceed in parallel:    │
│                                           │
│  Phase 3: US1 - Registration (P1) 🎯 MVP  │
│  Phase 4: US2 - Login (P1) 🎯 MVP         │
│  Phase 5: US3 - Profile (P2)              │
│  Phase 6: US4 - Change Password (P2)      │
│  Phase 7: US5 - Logout (P2)               │
└───────────────────────────────────────────┘
    ↓
Phase 8: Polish
```

### User Story Dependencies

| Story                 | Depends On                               | Can Parallel With  |
| --------------------- | ---------------------------------------- | ------------------ |
| US1 (Registration)    | Phase 2 only                             | US2, US3, US4, US5 |
| US2 (Login)           | Phase 2 only                             | US1, US3, US4, US5 |
| US3 (Profile)         | Phase 2, needs auth working (US1 or US2) | US4, US5           |
| US4 (Change Password) | Phase 2, US3 (shares profile page)       | US5                |
| US5 (Logout)          | Phase 2, needs auth working (US1 or US2) | US3, US4           |

### Within Each User Story

1. Page UI component (can parallel with server file)
2. Server load/action implementation
3. Client-side validation
4. Error handling
5. Success feedback

### Parallel Opportunities

```bash
# Phase 1 - All can run in parallel:
T002, T003

# Phase 2 - After T004, these can run in parallel:
T005, T006, T009, T010

# Phase 3 (US1) - T011 can start immediately:
T011 (UI) can parallel with nothing until Phase 2 complete

# Phase 4 (US2) - After Phase 2:
T018 (UI) in parallel with T011 (US1 UI)

# Phase 8 - Multiple tasks can run in parallel:
T046, T048, T049, T050, T051
```

---

## Parallel Example: Foundation + MVP Stories

```bash
# After Phase 1 complete, launch Phase 2 foundational tasks:
T004 → T005, T006, T009, T010 (parallel after T004)
       ↓
T007 → T008 (sequential - depends on T004, T005)

# Once Phase 2 complete, launch MVP stories in parallel:
# Developer A: User Story 1 (Registration)
T011 → T012 → T013 → T014 → T015 → T016 → T017

# Developer B: User Story 2 (Login)
T018 → T019 → T020 → T021 → T022 → T023 → T024 → T025
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T010)
3. Complete Phase 3: User Story 1 - Registration
4. Complete Phase 4: User Story 2 - Login
5. **STOP and VALIDATE**: Test signup/login flow end-to-end
6. Deploy/demo if ready - users can now register and log in!

### Incremental Delivery

| Increment | Stories   | Value Delivered                 |
| --------- | --------- | ------------------------------- |
| MVP       | US1 + US2 | Users can register and log in   |
| +Profile  | +US3      | Users can view/edit username    |
| +Password | +US4      | Users can change password       |
| +Logout   | +US5      | Users can securely sign out     |
| +Polish   | Phase 8   | Session handling, accessibility |

### Suggested MVP Scope

**For quickest working demo**: Complete through Phase 4 (US1 + US2)

This delivers:

- ✅ User registration with email/username/password
- ✅ User login with email/password
- ✅ Session persistence
- ✅ Basic navigation (login/signup links)

---

## Notes

- All UI components use Svelte 5 runes (`$state()`, `$effect()`, `$props()`)
- All pages follow sci-fi aesthetic (cyan primary, Orbitron/Rajdhani fonts, corner borders)
- All routes use `{base}` from `$app/paths` for base path compliance
- Form actions use SvelteKit's native form handling (progressive enhancement)
- Error messages mapped from Supabase codes to user-friendly text (FR-015)
- Commit after each task or logical group
- Run `npm run check` and `npm run lint` before marking Phase 8 complete
