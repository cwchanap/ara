import { describe, expect, test } from 'vitest';

describe('@neondatabase/auth contract', () => {
	test('exports the vanilla auth client used by the SvelteKit adapter', async () => {
		const mod = await import('@neondatabase/auth');
		const vanilla = await import('@neondatabase/auth/vanilla');
		const adapterExport = ['Supa', 'baseAuthAdapter'].join('');

		expect(typeof mod.createAuthClient).toBe('function');
		expect(typeof vanilla[adapterExport as keyof typeof vanilla]).toBe('function');
	});

	test('supports Google OAuth through the default Better Auth API', async () => {
		const mod = await import('@neondatabase/auth');
		const auth = mod.createAuthClient('https://example.neonauth.invalid/auth');

		expect(typeof auth.signIn.social).toBe('function');
		expect(typeof auth.signOut).toBe('function');
		expect(typeof auth.getSession).toBe('function');
	});
});
