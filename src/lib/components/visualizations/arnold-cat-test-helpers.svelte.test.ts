import { describe, expect, test } from 'vitest';
import { createReactiveProps } from './arnold-cat-test-helpers.svelte';

describe('createReactiveProps', () => {
	test('proxy reads initial values via get trap', () => {
		const [props] = createReactiveProps({ a: 1, b: 'hello' });
		expect(props.a).toBe(1);
		expect(props.b).toBe('hello');
	});

	test('update mutates state and proxy reflects new values', () => {
		const [props, update] = createReactiveProps({ a: 1, b: 2 });
		update({ a: 10 });
		expect(props.a).toBe(10);
		expect(props.b).toBe(2);
	});

	test('Object.keys enumerates via ownKeys trap', () => {
		const [props] = createReactiveProps({ x: 1, y: 2, z: 3 });
		expect(Object.keys(props).sort()).toEqual(['x', 'y', 'z']);
	});

	test('has trap reports property existence', () => {
		const [props] = createReactiveProps({ a: 1 });
		expect('a' in props).toBe(true);
		expect('missing' in props).toBe(false);
	});

	test('getOwnPropertyDescriptor returns descriptors from state', () => {
		const [props] = createReactiveProps({ a: 1 });
		const desc = Object.getOwnPropertyDescriptor(props, 'a');
		expect(desc).toBeDefined();
		expect(desc?.value).toBe(1);
		expect(Object.getOwnPropertyDescriptor(props, 'missing')).toBeUndefined();
	});
});
