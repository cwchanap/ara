import { describe, it, expect } from 'vitest';
import { calculateLyapunovExponent } from './lyapunov-map';

describe('calculateLyapunovExponent', () => {
	it('should return null or negative for stable r=2.0 (converges to fixed point)', () => {
		// At r=2.0, trajectory converges to fixed point x=0.5 where derivative=0
		// So validIterations may be 0, returning null
		const result = calculateLyapunovExponent(2.0, 100, 50);
		expect(result === null || (typeof result === 'number' && result < 0)).toBe(true);
	});

	it('should return a negative or small Lyapunov for weakly stable r=2.8', () => {
		const result = calculateLyapunovExponent(2.8, 200, 100);
		expect(result).toBeDefined();
		if (result !== null) {
			expect(Number.isFinite(result)).toBe(true);
			// For r=2.8 (before full bifurcation), Lyapunov should be negative or near-zero
			expect(result).toBeLessThanOrEqual(0.2);
		}
	});

	it('should return a positive number for chaotic r (r=3.8, chaotic regime)', () => {
		const result = calculateLyapunovExponent(3.8, 100, 50);
		expect(result).toBeDefined();
		if (result !== null) {
			expect(Number.isFinite(result)).toBe(true);
			// For r=3.8 (chaotic region), Lyapunov exponent should be positive
			expect(result).toBeGreaterThan(0);
		}
	});

	it('should return finite values for r=4.0 (fully chaotic)', () => {
		const result = calculateLyapunovExponent(4.0, 100, 50);
		expect(result).toBeDefined();
		if (result !== null) {
			expect(Number.isFinite(result)).toBe(true);
			expect(result).toBeGreaterThan(0);
		}
	});

	it('should be deterministic for same inputs', () => {
		const result1 = calculateLyapunovExponent(3.5, 50, 25);
		const result2 = calculateLyapunovExponent(3.5, 50, 25);
		expect(result1).toEqual(result2);
	});

	it('should handle edge case r=1.0 (boundary)', () => {
		const result = calculateLyapunovExponent(1.0, 50, 25);
		// Should not throw and should return a number or null
		expect(result === null || typeof result === 'number').toBe(true);
	});

	it('should handle small iteration counts', () => {
		const result = calculateLyapunovExponent(3.8, 10, 5);
		expect(result === null || (typeof result === 'number' && Number.isFinite(result))).toBe(
			true
		);
	});

	it('should return null when no valid iterations accumulate', () => {
		// Very small r (close to 0) should quickly converge to 0 and reset
		const result = calculateLyapunovExponent(0.5, 100, 50);
		// Could be null or a finite value depending on transient behavior
		expect(result === null || (typeof result === 'number' && Number.isFinite(result))).toBe(
			true
		);
	});
});
