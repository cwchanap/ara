/**
 * Tests for supabase-admin server utilities.
 *
 * Covers createAdminClient and deleteAuthUser, exercising the
 * no-key fallback, successful deletion, and error paths.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

// ── @supabase/supabase-js mock ────────────────────────────────────────────────

let mockDeleteError: Error | null = null;
let mockDeleteShouldThrow = false;
let createClientCalled = false;
let lastCreateClientArgs: unknown[] = [];

mock.module('@supabase/supabase-js', () => ({
	createClient: (...args: unknown[]) => {
		createClientCalled = true;
		lastCreateClientArgs = args;
		return {
			auth: {
				admin: {
					deleteUser: async (_userId: string) => {
						if (mockDeleteShouldThrow) {
							throw new Error('Network failure');
						}
						return { error: mockDeleteError };
					}
				}
			}
		};
	}
}));

// Dynamic import AFTER mock registration.
const { createAdminClient, deleteAuthUser } = await import('./supabase-admin');

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORIGINAL_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

beforeEach(() => {
	mockDeleteError = null;
	mockDeleteShouldThrow = false;
	createClientCalled = false;
	lastCreateClientArgs = [];
});

afterEach(() => {
	// Restore the env var after each test that might modify it.
	if (ORIGINAL_SERVICE_KEY === undefined) {
		delete process.env.SUPABASE_SERVICE_ROLE_KEY;
	} else {
		process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_SERVICE_KEY;
	}
});

// ── createAdminClient ─────────────────────────────────────────────────────────

describe('createAdminClient', () => {
	test('returns null when SUPABASE_SERVICE_ROLE_KEY is not set', () => {
		delete process.env.SUPABASE_SERVICE_ROLE_KEY;
		const client = createAdminClient();
		expect(client).toBeNull();
		expect(createClientCalled).toBe(false);
	});

	test('returns a client object when SUPABASE_SERVICE_ROLE_KEY is set', () => {
		process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
		const client = createAdminClient();
		expect(client).not.toBeNull();
		expect(createClientCalled).toBe(true);
	});

	test('passes the service role key to createClient', () => {
		process.env.SUPABASE_SERVICE_ROLE_KEY = 'my-secret-key';
		createAdminClient();
		expect(lastCreateClientArgs[1]).toBe('my-secret-key');
	});
});

// ── deleteAuthUser ────────────────────────────────────────────────────────────

describe('deleteAuthUser', () => {
	test('returns false when SUPABASE_SERVICE_ROLE_KEY is not set', async () => {
		delete process.env.SUPABASE_SERVICE_ROLE_KEY;
		const result = await deleteAuthUser('user-123');
		expect(result).toBe(false);
	});

	test('returns true on successful deletion', async () => {
		process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
		const result = await deleteAuthUser('user-123');
		expect(result).toBe(true);
	});

	test('returns false when deleteUser returns an error', async () => {
		process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
		mockDeleteError = new Error('User not found');
		const result = await deleteAuthUser('user-999');
		expect(result).toBe(false);
	});

	test('returns false when deleteUser throws an exception', async () => {
		process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
		mockDeleteShouldThrow = true;
		const result = await deleteAuthUser('user-999');
		expect(result).toBe(false);
	});
});
