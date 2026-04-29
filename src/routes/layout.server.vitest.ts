import { describe, expect, it, vi } from 'vitest';

import { load } from './+layout.server';

function makeEvent({
	session = null,
	user = null
}: {
	session?: Record<string, unknown> | null;
	user?: Record<string, unknown> | null;
} = {}) {
	return {
		locals: {
			safeGetSession: vi.fn(async () => ({ session, user }))
		},
		depends: vi.fn()
	};
}

describe('layout server load', () => {
	it('returns null session and user for unauthenticated requests', async () => {
		const event = makeEvent();
		const result = await load(event as unknown as Parameters<typeof load>[0]);
		expect(result).toEqual({ session: null, user: null });
	});

	it('returns session and user for authenticated requests', async () => {
		const session = { access_token: 'tok', expires_at: 9999999999 };
		const user = { id: 'user-1', email: 'user@example.com' };
		const result = await load(
			makeEvent({ session, user }) as unknown as Parameters<typeof load>[0]
		);
		expect(result).toMatchObject({ session, user });
	});

	it('calls depends with "supabase:auth"', async () => {
		const event = makeEvent();
		await load(event as unknown as Parameters<typeof load>[0]);
		expect(event.depends).toHaveBeenCalledWith('supabase:auth');
	});

	it('calls safeGetSession exactly once per load', async () => {
		const event = makeEvent();
		await load(event as unknown as Parameters<typeof load>[0]);
		expect(event.locals.safeGetSession).toHaveBeenCalledTimes(1);
	});
});
