import { describe, test, expect, mock } from 'bun:test';
import { useDebouncedEffect } from './use-debounced-effect';

describe('useDebouncedEffect', () => {
	test('returns trigger and cleanup functions', () => {
		const fn = mock(() => {});
		const debounced = useDebouncedEffect(fn, 100);

		expect(debounced).toHaveProperty('trigger');
		expect(debounced).toHaveProperty('cleanup');
		expect(typeof debounced.trigger).toBe('function');
		expect(typeof debounced.cleanup).toBe('function');
	});

	test('debounces function calls', async () => {
		const fn = mock(() => {});
		const debounced = useDebouncedEffect(fn, 50);

		debounced.trigger();
		debounced.trigger();
		debounced.trigger();

		expect(fn).not.toHaveBeenCalled();

		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test('cleanup cancels pending execution', async () => {
		const fn = mock(() => {});
		const debounced = useDebouncedEffect(fn, 50);

		debounced.trigger();
		debounced.cleanup();

		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(fn).not.toHaveBeenCalled();
	});

	test('multiple triggers only execute once after delay', async () => {
		let callCount = 0;
		const fn = mock(() => {
			callCount++;
		});
		const debounced = useDebouncedEffect(fn, 30);

		// Trigger multiple times within the debounce window
		debounced.trigger();
		await new Promise((resolve) => setTimeout(resolve, 10));
		debounced.trigger();
		await new Promise((resolve) => setTimeout(resolve, 10));
		debounced.trigger();

		// Should not have been called yet
		expect(callCount).toBe(0);

		// Wait for debounce to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Should have been called exactly once
		expect(callCount).toBe(1);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test('uses default delay of 300ms when none specified', async () => {
		const fn = mock(() => {});
		const debounced = useDebouncedEffect(fn); // no delay arg

		debounced.trigger();

		// Not called within shorter window
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(fn).not.toHaveBeenCalled();

		// Called after full 300ms default, with extra buffer to avoid flakiness on slow CI
		await new Promise((resolve) => setTimeout(resolve, 400));
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test('cleanup is safe to call when no timer is pending', () => {
		const fn = mock(() => {});
		const debounced = useDebouncedEffect(fn, 50);

		// Call cleanup without triggering first — should not throw
		expect(() => debounced.cleanup()).not.toThrow();
	});

	test('cleanup is idempotent (calling it twice is safe)', async () => {
		const fn = mock(() => {});
		const debounced = useDebouncedEffect(fn, 50);

		debounced.trigger();
		debounced.cleanup();
		debounced.cleanup(); // second cleanup should not throw

		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(fn).not.toHaveBeenCalled();
	});

	test('trigger after cleanup schedules a new execution', async () => {
		const fn = mock(() => {});
		const debounced = useDebouncedEffect(fn, 50);

		debounced.trigger();
		debounced.cleanup();

		// Trigger again after cleanup — should work normally
		debounced.trigger();

		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test('fn is called with no arguments', async () => {
		let callCount = 0;
		let capturedArgCount = -1;
		const fn = mock((...args: unknown[]) => {
			callCount++;
			capturedArgCount = args.length;
		});
		const debounced = useDebouncedEffect(fn, 30);
		debounced.trigger();

		await new Promise((resolve) => setTimeout(resolve, 60));
		expect(callCount).toBe(1);
		expect(capturedArgCount).toBe(0);
	});
});
