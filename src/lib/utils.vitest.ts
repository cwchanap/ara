import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn (class name utility)', () => {
	it('returns empty string for no arguments', () => {
		expect(cn()).toBe('');
	});

	it('returns the class when given a single string', () => {
		expect(cn('foo')).toBe('foo');
	});

	it('joins multiple class strings with a space', () => {
		expect(cn('foo', 'bar')).toBe('foo bar');
	});

	it('ignores falsy values', () => {
		expect(cn('foo', undefined, null, false, 'bar')).toBe('foo bar');
	});

	it('handles conditional objects', () => {
		expect(cn({ foo: true, bar: false })).toBe('foo');
	});

	it('deduplicates conflicting Tailwind classes (last wins)', () => {
		const result = cn('text-red-500', 'text-blue-500');
		expect(result).toBe('text-blue-500');
	});

	it('merges multiple class sources correctly', () => {
		const result = cn('p-4', 'text-sm', { 'font-bold': true, italic: false });
		expect(result).toContain('p-4');
		expect(result).toContain('text-sm');
		expect(result).toContain('font-bold');
		expect(result).not.toContain('italic');
	});

	it('handles array inputs', () => {
		const result = cn(['foo', 'bar']);
		expect(result).toContain('foo');
		expect(result).toContain('bar');
	});
});
