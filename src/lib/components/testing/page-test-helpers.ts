/**
 * Shared test utilities for page-interaction tests.
 *
 * Eliminates ~100 lines of duplicated boilerplate per test file:
 * - Mock `$app/stores` page store (singleton shared between vi.mock factory and test code)
 * - Standard page data / props (authenticated and unauthenticated)
 * - Fetch mock setup/teardown
 * - Single source of truth for the base path
 *
 * Usage in a test file:
 *
 * ```ts
 * vi.mock('$app/stores', async () => {
 *   const { mockPageStore } = await import('$lib/components/testing/page-test-helpers');
 *   return { page: mockPageStore };
 * });
 *
 * import { authedPageProps, setMockPageUrl, setupApiFetchMock, restoreFetch } from '$lib/components/testing/page-test-helpers';
 * ```
 */
import type { Page } from '@sveltejs/kit';
import { vi } from 'vitest';

/**
 * The production base path. `svelte.config.js` defines no `kit.paths.base`,
 * so this is an empty string. Defining it here as a single source of truth
 * prevents the drift that occurred when individual test files hardcoded
 * differing values (`''` vs `'/app'`).
 */
export const BASE_PATH = '';

// ---------------------------------------------------------------------------
// Page data factories
// ---------------------------------------------------------------------------

export type PageData = Page['data'];

/** Standard authenticated page data used by most visualization pages. */
export function createAuthedPageData(): PageData {
	return {
		session: { user: { id: 'test' } },
		user: { id: 'test' },
		profile: {
			id: 'test',
			username: 'testuser',
			createdAt: '2024-01-01',
			updatedAt: '2024-01-01'
		}
	};
}

/** Unauthenticated page data (no session / user / profile). */
export function createUnauthedPageData(): PageData {
	return {
		session: null,
		user: null,
		profile: null
	};
}

/** Build a complete `Page` object for the mock store. */
export function createTestPage(url: string, data?: PageData): Page {
	return {
		url: new URL(url) as Page['url'],
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: data ?? createAuthedPageData(),
		form: null,
		state: {}
	};
}

// ---------------------------------------------------------------------------
// Singleton mock page store
// ---------------------------------------------------------------------------
//
// Vitest isolates the module registry per test file, so each file gets its own
// instance of this singleton.  The same instance is shared between the
// `vi.mock('$app/stores', ...)` factory (via dynamic import) and the test code
// (via static import), giving tests a handle to mutate the store.

let currentPage: Page = createTestPage('http://localhost/');
const pageSubscribers = new Set<(value: Page) => void>();

export const mockPageStore = {
	subscribe(run: (value: Page) => void): () => void {
		run(currentPage);
		pageSubscribers.add(run);
		return () => pageSubscribers.delete(run);
	}
};

/** Update the mock page store URL (and optionally data), notifying subscribers. */
export function setMockPageUrl(url: string, data?: PageData): void {
	currentPage = createTestPage(url, data);
	pageSubscribers.forEach((s) => s(currentPage));
}

/** Reset the mock page store to a known state. Call in `afterEach` to avoid leakage. */
export function resetMockPageStore(url = 'http://localhost/', data?: PageData): void {
	currentPage = createTestPage(url, data);
	pageSubscribers.forEach((s) => s(currentPage));
}

// ---------------------------------------------------------------------------
// Standard page props
// ---------------------------------------------------------------------------

export const authedPageProps = { data: createAuthedPageData() };
export const unauthedPageProps = { data: createUnauthedPageData() };

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

/** Install a global `fetch` mock returning a successful save/share response. */
export function setupApiFetchMock(): void {
	globalThis.fetch = vi.fn().mockImplementation(() =>
		Promise.resolve({
			ok: true,
			json: () =>
				Promise.resolve({
					success: true,
					shareUrl: 'http://loc/shared',
					expiresAt: '2026-06-03'
				})
		} as Response)
	) as unknown as typeof globalThis.fetch;
}

/** Restore the original `fetch`. Call in `afterEach` when `setupApiFetchMock` was used. */
export function restoreFetch(): void {
	globalThis.fetch = originalFetch;
}
