import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { RequestEvent } from '@sveltejs/kit';

let getSessionResult: { data: unknown; error: unknown } = {
	data: { user: { id: 'user-1', email: 'ada@example.com', name: 'Ada' } },
	error: null
};

const getSession = mock(async () => getSessionResult);
const createNeonAuthClient = mock((options: unknown) => {
	void options;
	return { getSession };
});

mock.module('$lib/auth/neon.server', () => ({
	createNeonAuthClient
}));

mock.module('$lib/auth/neon', () => ({
	normalizeSession: (data: unknown) => {
		const session = data as { user?: { id: string; email?: string; name?: string } };
		return session?.user?.id ? { session, user: session.user } : { session: null, user: null };
	}
}));

const { handle } = await import('./hooks.server');

describe('hooks.server', () => {
	beforeEach(() => {
		getSessionResult = {
			data: { user: { id: 'user-1', email: 'ada@example.com', name: 'Ada' } },
			error: null
		};
		getSession.mockClear();
		createNeonAuthClient.mockClear();
	});

	test('sets neonAuth and safeGetSession on locals', async () => {
		const request = new Request('http://localhost', { headers: { cookie: 'auth=value' } });
		const event = { locals: {}, request } as RequestEvent;
		const resolve = mock(async () => new Response('ok'));

		await handle({ event, resolve });

		expect(createNeonAuthClient).toHaveBeenCalledWith({ headers: request.headers });
		expect(event.locals.neonAuth).toBeDefined();
		expect(resolve).toHaveBeenCalledWith(event);

		const result = await event.locals.safeGetSession();
		expect(getSession).toHaveBeenCalled();
		expect(result.user?.id).toBe('user-1');
		expect(result.session).toEqual({
			user: { id: 'user-1', email: 'ada@example.com', name: 'Ada' }
		});
	});

	test('safeGetSession returns null session and user when Neon Auth returns an error', async () => {
		getSessionResult = { data: null, error: { message: 'Invalid session' } };
		const request = new Request('http://localhost');
		const event = { locals: {}, request } as RequestEvent;
		const resolve = mock(async () => new Response('ok'));

		await handle({ event, resolve });

		await expect(event.locals.safeGetSession()).resolves.toEqual({
			session: null,
			user: null
		});
	});
});
