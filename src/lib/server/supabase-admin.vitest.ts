import { afterEach, describe, expect, it, vi } from 'vitest';

// ── Mutable env object ─────────────────────────────────────────────────────────
// supabase-admin.ts imports `env` by reference, so mutations are visible to
// subsequent calls to createAdminClient() without re-importing the module.
const mockEnv = vi.hoisted<{ SUPABASE_SERVICE_ROLE_KEY: string | undefined }>(() => ({
	SUPABASE_SERVICE_ROLE_KEY: undefined
}));
const deleteUserMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
	createClient: createClientMock
}));

vi.mock('$env/static/public', () => ({
	PUBLIC_SUPABASE_URL: 'https://test.supabase.co'
}));

vi.mock('$env/dynamic/private', () => ({
	env: mockEnv
}));

import { createAdminClient, deleteAuthUser } from './supabase-admin';

describe('createAdminClient', () => {
	afterEach(() => {
		mockEnv.SUPABASE_SERVICE_ROLE_KEY = undefined;
		vi.clearAllMocks();
	});

	it('returns null when SUPABASE_SERVICE_ROLE_KEY is not set', () => {
		const result = createAdminClient();
		expect(result).toBeNull();
	});

	it('logs a warning when service role key is missing', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		createAdminClient();
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SUPABASE_SERVICE_ROLE_KEY'));
		warnSpy.mockRestore();
	});
});

describe('deleteAuthUser', () => {
	afterEach(() => {
		mockEnv.SUPABASE_SERVICE_ROLE_KEY = undefined;
		vi.clearAllMocks();
	});

	it('returns false when admin client is not available (no service role key)', async () => {
		const result = await deleteAuthUser('user-123');
		expect(result).toBe(false);
	});

	it('returns true when deleteUser succeeds', async () => {
		mockEnv.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
		deleteUserMock.mockResolvedValueOnce({ error: null });
		createClientMock.mockReturnValueOnce({
			auth: { admin: { deleteUser: deleteUserMock } }
		});

		const result = await deleteAuthUser('user-123');
		expect(result).toBe(true);
		expect(deleteUserMock).toHaveBeenCalledWith('user-123');
	});

	it('returns false when deleteUser returns an error', async () => {
		mockEnv.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
		deleteUserMock.mockResolvedValueOnce({ error: new Error('User not found') });
		createClientMock.mockReturnValueOnce({
			auth: { admin: { deleteUser: deleteUserMock } }
		});

		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = await deleteAuthUser('user-with-error');
		expect(result).toBe(false);
		expect(deleteUserMock).toHaveBeenCalledWith('user-with-error');
		consoleErrorSpy.mockRestore();
	});
});
