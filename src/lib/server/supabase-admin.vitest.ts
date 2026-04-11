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

	it('returns a non-null client when SUPABASE_SERVICE_ROLE_KEY is set', () => {
		mockEnv.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
		createClientMock.mockReturnValueOnce({ auth: { admin: {} } });
		const result = createAdminClient();
		expect(result).not.toBeNull();
		expect(createClientMock).toHaveBeenCalledTimes(1);
	});

	it('passes the service role key as the second argument to createClient', () => {
		mockEnv.SUPABASE_SERVICE_ROLE_KEY = 'my-secret-key';
		createClientMock.mockReturnValueOnce({ auth: { admin: {} } });
		createAdminClient();
		expect(createClientMock).toHaveBeenCalledWith(
			'https://test.supabase.co',
			'my-secret-key',
			expect.any(Object)
		);
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

	it('returns false when deleteUser throws an exception', async () => {
		mockEnv.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
		deleteUserMock.mockRejectedValueOnce(new Error('Network failure'));
		createClientMock.mockReturnValueOnce({
			auth: { admin: { deleteUser: deleteUserMock } }
		});

		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = await deleteAuthUser('user-throws');
		expect(result).toBe(false);
		consoleErrorSpy.mockRestore();
	});
});
