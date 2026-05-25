import { describe, expect, test } from 'bun:test';
import { getSafeRedirectPath, withRedirectParam } from './redirects';

describe('getSafeRedirectPath', () => {
	test('uses fallback when redirect is missing', () => {
		expect(getSafeRedirectPath(null, '/app')).toBe('/app');
	});

	test('allows same-origin absolute paths', () => {
		expect(getSafeRedirectPath('/saved-configs', '/')).toBe('/saved-configs');
	});

	test('rejects absolute URLs', () => {
		expect(getSafeRedirectPath('https://evil.example', '/')).toBe('/');
	});

	test('rejects protocol-relative URLs', () => {
		expect(getSafeRedirectPath('//evil.example', '/')).toBe('/');
	});

	test('rejects slash-backslash host-like URLs', () => {
		expect(getSafeRedirectPath('/\\evil.example', '/')).toBe('/');
	});

	test('falls back to slash when base is empty', () => {
		expect(getSafeRedirectPath(null, '')).toBe('/');
	});
});

describe('withRedirectParam', () => {
	test('appends encoded safe redirect', () => {
		expect(withRedirectParam('/login', '/saved-configs')).toBe(
			'/login?redirect=%2Fsaved-configs'
		);
	});

	test('does not append fallback redirect', () => {
		expect(withRedirectParam('/login', '/')).toBe('/login');
	});

	test('appends redirect with ampersand when path already has query params', () => {
		expect(withRedirectParam('/login?mode=signin', '/saved-configs')).toBe(
			'/login?mode=signin&redirect=%2Fsaved-configs'
		);
	});
});
