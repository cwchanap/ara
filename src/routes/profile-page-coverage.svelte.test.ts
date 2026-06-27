import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import ProfilePage from './profile/+page.svelte';
import type { Profile } from '$lib/types';

// Capture the enhance submit callback so we can invoke it directly.
const enhanceState = vi.hoisted(() => ({
	capturedSubmitCallback: null as
		| (() => (props: { update: () => Promise<void> }) => Promise<void>)
		| null
}));

vi.mock('$app/paths', () => ({ base: '' }));
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

function makeProfileData(overrides?: {
	profile?: Profile | null;
	user?: App.PageData['user'];
}): App.PageData {
	const profile: Profile | null =
		overrides?.profile === undefined
			? { id: 'user-1', username: 'chaos_user', createdAt: '', updatedAt: '' }
			: overrides.profile;
	return {
		session: null,
		user: overrides?.user ?? { id: 'user-1', email: 'user@example.com' },
		profile
	};
}

describe('profile page – form.updateError and enhance callback', () => {
	it('displays updateError from form prop when username differs from profile', async () => {
		const { rerender } = render(ProfilePage, {
			props: {
				data: makeProfileData(),
				form: null
			}
		});
		// Change the username to differ from profile
		const usernameInput = screen.getByDisplayValue('chaos_user');
		await fireEvent.input(usernameInput, { target: { value: 'new_user' } });
		await tick();

		// Now rerender with form.updateError — the form effect will set usernameError
		// and since username !== profile.username, the error will be displayed
		rerender({
			data: makeProfileData(),
			form: { updateError: 'Username already taken', username: 'new_user' }
		});
		await tick();
		expect(screen.getByText('Username already taken')).toBeInTheDocument();
	});

	it('toggles isUpdatingUsername when enhance submit callback fires', async () => {
		render(ProfilePage, {
			props: { data: makeProfileData(), form: null }
		});
		expect(enhanceState.capturedSubmitCallback).not.toBeNull();

		const update = vi.fn(async () => {});
		const resultFn = enhanceState.capturedSubmitCallback!();
		await tick();
		// isUpdatingUsername should be true → button shows "Updating..."
		expect(screen.getByText('Updating...')).toBeInTheDocument();

		await resultFn({ update });
		await tick();
		expect(update).toHaveBeenCalled();
		expect(screen.getByRole('button', { name: /update username/i })).toBeInTheDocument();
	});

	it('sets isUpdatingUsername to false even when update throws', async () => {
		render(ProfilePage, {
			props: { data: makeProfileData(), form: null }
		});
		expect(enhanceState.capturedSubmitCallback).not.toBeNull();

		const update = vi.fn(async () => {
			throw new Error('update failed');
		});
		const resultFn = enhanceState.capturedSubmitCallback!();
		await tick();
		expect(screen.getByText('Updating...')).toBeInTheDocument();

		await expect(resultFn({ update })).rejects.toThrow('update failed');
		await tick();
		expect(screen.getByRole('button', { name: /update username/i })).toBeInTheDocument();
	});

	it('clears usernameSuccess when enhance submit callback fires', async () => {
		// First render with updateSuccess to set the success message
		const { rerender } = render(ProfilePage, {
			props: {
				data: makeProfileData(),
				form: { updateSuccess: true, username: 'chaos_user' }
			}
		});
		expect(screen.getByText('Username updated successfully!')).toBeInTheDocument();

		// Re-render without form to clear the success effect, then trigger enhance
		rerender({ data: makeProfileData(), form: null });
		expect(enhanceState.capturedSubmitCallback).not.toBeNull();

		const update = vi.fn(async () => {});
		const resultFn = enhanceState.capturedSubmitCallback!();
		await tick();
		// usernameSuccess should be cleared by the submit callback
		expect(screen.queryByText('Username updated successfully!')).not.toBeInTheDocument();

		await resultFn({ update });
		await tick();
	});
});
