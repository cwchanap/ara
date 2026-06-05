import { describe, expect, test } from 'vitest';

const mod = await import('./+page.server');
const { load } = mod;

describe('signup page server', () => {
	test('redirects signup to login', async () => {
		await expect(
			load({ url: new URL('http://localhost/signup') } as unknown as Parameters<
				typeof load
			>[0])
		).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
	});

	test('preserves safe redirect param', async () => {
		await expect(
			load({
				url: new URL('http://localhost/signup?redirect=%2Fsaved-configs')
			} as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({
			status: 303,
			location: '/login?redirect=%2Fsaved-configs'
		});
	});

	test('drops unsafe redirect param', async () => {
		await expect(
			load({
				url: new URL('http://localhost/signup?redirect=https%3A%2F%2Fevil.example')
			} as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
	});

	test('does not export signup actions', () => {
		expect('actions' in mod).toBe(false);
	});
});
