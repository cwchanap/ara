import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedEffect } from './use-debounced-effect';

describe('useDebouncedEffect', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('calls fn after default 300ms delay', () => {
		const fn = vi.fn();
		const { trigger } = useDebouncedEffect(fn);

		trigger();
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(299);
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('calls fn after custom delay', () => {
		const fn = vi.fn();
		const { trigger } = useDebouncedEffect(fn, 500);

		trigger();
		vi.advanceTimersByTime(499);
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('debounces multiple rapid trigger calls', () => {
		const fn = vi.fn();
		const { trigger } = useDebouncedEffect(fn, 300);

		trigger();
		vi.advanceTimersByTime(100);
		trigger();
		vi.advanceTimersByTime(100);
		trigger();

		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(300);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('prevents fn from being called when cleanup runs before timer fires', () => {
		const fn = vi.fn();
		const { trigger, cleanup } = useDebouncedEffect(fn, 300);

		trigger();
		vi.advanceTimersByTime(100);
		cleanup();

		vi.advanceTimersByTime(500);
		expect(fn).not.toHaveBeenCalled();
	});

	it('does not throw when cleanup is called with no pending timer', () => {
		const fn = vi.fn();
		const { cleanup } = useDebouncedEffect(fn);

		expect(() => cleanup()).not.toThrow();
	});

	it('allows trigger to work after cleanup', () => {
		const fn = vi.fn();
		const { trigger, cleanup } = useDebouncedEffect(fn, 300);

		trigger();
		vi.advanceTimersByTime(100);
		cleanup();

		trigger();
		vi.advanceTimersByTime(300);
		expect(fn).toHaveBeenCalledTimes(1);
	});
});
