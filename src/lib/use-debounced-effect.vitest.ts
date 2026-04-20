import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useDebouncedEffect } from './use-debounced-effect';

describe('useDebouncedEffect', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('calls fn after the delay', () => {
		const fn = vi.fn();
		const { trigger } = useDebouncedEffect(fn, 200);
		trigger();
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(200);
		expect(fn).toHaveBeenCalledOnce();
	});

	it('uses default delay of 300ms', () => {
		const fn = vi.fn();
		const { trigger } = useDebouncedEffect(fn);
		trigger();
		vi.advanceTimersByTime(299);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledOnce();
	});

	it('debounces multiple rapid triggers', () => {
		const fn = vi.fn();
		const { trigger } = useDebouncedEffect(fn, 100);
		trigger();
		trigger();
		trigger();
		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledOnce();
	});

	it('resets the timer on each trigger', () => {
		const fn = vi.fn();
		const { trigger } = useDebouncedEffect(fn, 100);
		trigger();
		vi.advanceTimersByTime(80);
		trigger(); // reset timer
		vi.advanceTimersByTime(80);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(20);
		expect(fn).toHaveBeenCalledOnce();
	});

	it('cleanup cancels the pending timer', () => {
		const fn = vi.fn();
		const { trigger, cleanup } = useDebouncedEffect(fn, 100);
		trigger();
		cleanup();
		vi.advanceTimersByTime(200);
		expect(fn).not.toHaveBeenCalled();
	});

	it('cleanup is safe when no timer is pending', () => {
		const fn = vi.fn();
		const { cleanup } = useDebouncedEffect(fn, 100);
		expect(() => cleanup()).not.toThrow();
	});

	it('allows triggering again after cleanup', () => {
		const fn = vi.fn();
		const { trigger, cleanup } = useDebouncedEffect(fn, 100);
		trigger();
		cleanup();
		trigger();
		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledOnce();
	});

	it('clears timer reference after fn fires', () => {
		const fn = vi.fn();
		const { trigger, cleanup } = useDebouncedEffect(fn, 100);
		trigger();
		vi.advanceTimersByTime(100);
		// cleanup after fn fires should be safe (no timer to clear)
		expect(() => cleanup()).not.toThrow();
		expect(fn).toHaveBeenCalledOnce();
	});
});
