/**
 * Tests for utils.ts
 *
 * Tests the `cn()` class merging utility function.
 */

import { describe, expect, test } from 'bun:test';
import { cn } from './utils';

describe('cn', () => {
	describe('basic string merging', () => {
		test('returns empty string with no arguments', () => {
			expect(cn()).toBe('');
		});

		test('returns single class unchanged', () => {
			expect(cn('foo')).toBe('foo');
		});

		test('merges multiple class strings', () => {
			expect(cn('foo', 'bar')).toBe('foo bar');
		});

		test('handles multiple classes in a single string', () => {
			expect(cn('foo bar', 'baz')).toBe('foo bar baz');
		});
	});

	describe('falsy value handling', () => {
		test('ignores undefined values', () => {
			expect(cn('foo', undefined, 'bar')).toBe('foo bar');
		});

		test('ignores null values', () => {
			expect(cn('foo', null, 'bar')).toBe('foo bar');
		});

		test('ignores false values', () => {
			expect(cn('foo', false, 'bar')).toBe('foo bar');
		});

		test('ignores empty strings', () => {
			expect(cn('foo', '', 'bar')).toBe('foo bar');
		});

		test('handles all falsy values', () => {
			expect(cn(undefined, null, false, '')).toBe('');
		});
	});

	describe('conditional classes', () => {
		test('includes class when condition is true', () => {
			const isActive = true;
			expect(cn('base', isActive && 'active')).toBe('base active');
		});

		test('excludes class when condition is false', () => {
			const isActive = false;
			expect(cn('base', isActive && 'active')).toBe('base');
		});

		test('handles object syntax for conditional classes', () => {
			expect(cn({ active: true, disabled: false })).toBe('active');
		});

		test('handles multiple conditions in object syntax', () => {
			expect(cn({ active: true, disabled: true })).toBe('active disabled');
		});

		test('handles object and string mix', () => {
			expect(cn('base', { active: true })).toBe('base active');
		});
	});

	describe('array syntax', () => {
		test('handles array of class strings', () => {
			expect(cn(['foo', 'bar'])).toBe('foo bar');
		});

		test('handles nested arrays', () => {
			expect(cn(['foo', ['bar', 'baz']])).toBe('foo bar baz');
		});

		test('handles array with falsy values', () => {
			expect(cn(['foo', null, 'bar'])).toBe('foo bar');
		});
	});

	describe('Tailwind conflict resolution', () => {
		test('last padding wins when both specified', () => {
			expect(cn('p-2', 'p-4')).toBe('p-4');
		});

		test('last margin wins when both specified', () => {
			expect(cn('m-2', 'm-4')).toBe('m-4');
		});

		test('last text color wins', () => {
			expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
		});

		test('last background color wins', () => {
			expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
		});

		test('keeps non-conflicting classes', () => {
			const result = cn('flex', 'p-2', 'p-4');
			expect(result).toContain('flex');
			expect(result).toContain('p-4');
			expect(result).not.toContain('p-2');
		});

		test('later class overrides earlier conflicting class', () => {
			expect(cn('px-2', 'px-4')).toBe('px-4');
		});
	});

	describe('real-world usage patterns', () => {
		test('builds conditional component classes', () => {
			const isDisabled = true;
			const isPrimary = false;
			const result = cn(
				'btn',
				'rounded',
				isDisabled && 'opacity-50 cursor-not-allowed',
				isPrimary && 'bg-blue-500',
				!isPrimary && 'bg-gray-200'
			);
			expect(result).toBe('btn rounded opacity-50 cursor-not-allowed bg-gray-200');
		});

		test('handles className override pattern', () => {
			const baseClasses = 'text-sm font-medium';
			const userClasses = 'text-lg'; // Override text size
			const result = cn(baseClasses, userClasses);
			expect(result).toContain('text-lg');
			expect(result).not.toContain('text-sm');
		});
	});
});
