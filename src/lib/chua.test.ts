import { describe, expect, test } from 'bun:test';
import { chuaDiode } from './chua';

describe('chuaDiode', () => {
	const a = -8 / 7;
	const b = -5 / 7;

	test('f(0) is 0', () => {
		expect(chuaDiode(0, a, b)).toBeCloseTo(0, 12);
	});

	test('inner region slope equals a', () => {
		// For |x| <= 1, f(x) = a*x
		expect(chuaDiode(0.5, a, b)).toBeCloseTo(a * 0.5, 12);
		expect(chuaDiode(-0.5, a, b)).toBeCloseTo(a * -0.5, 12);
	});

	test('is continuous at the breakpoint x = 1', () => {
		// Inner value at x=1 is a*1; outer formula must match
		expect(chuaDiode(1, a, b)).toBeCloseTo(a, 12);
	});

	test('outer region slope equals b', () => {
		// For x >= 1, f(x) = b*x + (a - b); slope is b
		const f2 = chuaDiode(2, a, b);
		const f3 = chuaDiode(3, a, b);
		expect(f3 - f2).toBeCloseTo(b, 12);
	});

	test('is odd-symmetric', () => {
		expect(chuaDiode(-2, a, b)).toBeCloseTo(-chuaDiode(2, a, b), 12);
	});
});
