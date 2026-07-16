/**
 * Test-only helper for mounting ArnoldCatRenderer with individually reactive
 * props. @testing-library/svelte's rerender reassigns the entire props object
 * (via $state.raw), which triggers ALL $effects — including the pointCount
 * effect that resets iterationCount. This helper uses $state (deeply reactive)
 * so Object.assign only triggers effects for properties that actually change.
 *
 * Must be a .svelte.ts file so Svelte 5 runes ($state) are available.
 */

export function createReactiveProps<T extends Record<string, unknown>>(
	initial: T
): readonly [T, (updates: Partial<T>) => void] {
	const state = $state(initial);
	const props = new Proxy({} as T, {
		get(_, key: string) {
			return state[key as keyof T];
		},
		has(_, key: string) {
			return key in state;
		},
		ownKeys() {
			return Reflect.ownKeys(state);
		},
		getOwnPropertyDescriptor(_, key: string) {
			return Reflect.getOwnPropertyDescriptor(state, key);
		}
	});
	const update = (updates: Partial<T>) => {
		Object.assign(state, updates);
	};
	return [props, update] as const;
}
