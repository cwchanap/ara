import { beforeEach, describe, expect, it, vi } from 'vitest';

const createBrowserClientMock = vi.hoisted(() => vi.fn());

vi.mock('@supabase/ssr', () => ({
	createBrowserClient: createBrowserClientMock
}));

vi.mock('$env/static/public', () => ({
	PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
	PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
}));

import { createClient } from './supabase';

describe('createClient', () => {
	beforeEach(() => {
		createBrowserClientMock.mockReset();
	});

	it('returns the value from createBrowserClient', () => {
		const fakeClient = { auth: {} };
		createBrowserClientMock.mockReturnValueOnce(fakeClient);
		const result = createClient();
		expect(result).toBe(fakeClient);
	});

	it('calls createBrowserClient with the configured URL and key', () => {
		createBrowserClientMock.mockReturnValueOnce({});
		createClient();
		expect(createBrowserClientMock).toHaveBeenCalledWith(
			'https://test.supabase.co',
			'test-anon-key'
		);
	});

	it('creates a new client on each call', () => {
		createBrowserClientMock.mockReturnValue({ id: 'client' });
		createClient();
		createClient();
		expect(createBrowserClientMock).toHaveBeenCalledTimes(2);
	});
});
