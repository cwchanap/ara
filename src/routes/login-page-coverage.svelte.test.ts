import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import LoginPage from './login/+page.svelte';

// Capture the enhance submit callback so we can invoke it directly.
// Svelte actions receive (node, ...args), so enhance(formEl, callback).
const enhanceState = vi.hoisted(() => ({
	capturedSubmitCallback: null as
		| (() => (props: { update: () => Promise<void> }) => Promise<void>)
		| null
}));

vi.mock('$app/forms', () => ({
	enhance: vi.fn(
		(
			_node: HTMLElement,
			cb: () => (props: { update: () => Promise<void> }) => Promise<void>
		) => {
			enhanceState.capturedSubmitCallback = cb;
			return { destroy: vi.fn() };
		}
	)
}));

afterEach(() => {
	enhanceState.capturedSubmitCallback = null;
	cleanup();
});

describe('login page – enhance callback', () => {
	it('toggles isLoading to true when the enhance submit callback fires', async () => {
		render(LoginPage, { props: { form: null } });
		expect(enhanceState.capturedSubmitCallback).not.toBeNull();

		// The submit callback sets isLoading = true and returns a function
		// that awaits update() then sets isLoading = false.
		const update = vi.fn(async () => {});
		const resultFn = enhanceState.capturedSubmitCallback!();
		await tick();
		expect(screen.getByRole('button', { name: /connecting/i })).toBeInTheDocument();

		// Now call the returned function to simulate the response arriving
		await resultFn({ update });
		await tick();
		expect(update).toHaveBeenCalled();
		expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
	});

	it('sets isLoading to false even when update throws', async () => {
		render(LoginPage, { props: { form: null } });
		expect(enhanceState.capturedSubmitCallback).not.toBeNull();

		const update = vi.fn(async () => {
			throw new Error('network failure');
		});
		const resultFn = enhanceState.capturedSubmitCallback!();
		await tick();
		expect(screen.getByRole('button', { name: /connecting/i })).toBeInTheDocument();

		// The finally block should reset isLoading even on error
		await expect(resultFn({ update })).rejects.toThrow('network failure');
		await tick();
		expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
	});
});
