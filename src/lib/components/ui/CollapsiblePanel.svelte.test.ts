import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import CollapsiblePanel from './CollapsiblePanel.svelte';
import { PANEL_STORAGE_KEYS } from '$lib/chaos-panel-storage';
import { resetPanelOpenStoresForTests } from '$lib/chaos-panel-open-store';

function installMemoryStorage() {
	const map = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
		setItem: (k: string, v: string) => {
			map.set(k, v);
		},
		removeItem: (k: string) => {
			map.delete(k);
		},
		clear: () => map.clear()
	});
	return map;
}

const body = createRawSnippet(() => ({
	render: () => '<button data-testid="inside-body">Inside</button>'
}));

describe('CollapsiblePanel', () => {
	beforeEach(() => {
		installMemoryStorage();
		resetPanelOpenStoresForTests();
	});

	afterEach(() => {
		cleanup();
		resetPanelOpenStoresForTests();
		vi.unstubAllGlobals();
	});

	it('starts from defaultOpen=true with body visible and aria-expanded true', async () => {
		render(CollapsiblePanel, {
			props: {
				title: 'SYSTEM_PARAMETERS',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body',
				children: body
			}
		});
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /SYSTEM_PARAMETERS/i })).toHaveAttribute(
				'aria-expanded',
				'true'
			);
		});
		const region = document.getElementById('chaos-panel-parameters-body');
		expect(region).toBeTruthy();
		expect(region!.classList.contains('hidden')).toBe(false);
		expect(screen.getByTestId('inside-body')).toBeInTheDocument();
	});

	it('starts from defaultOpen=false with body hidden', async () => {
		render(CollapsiblePanel, {
			props: {
				title: 'DATA_LOG',
				storageKey: PANEL_STORAGE_KEYS.description,
				defaultOpen: false,
				bodyId: 'chaos-panel-description-body',
				titleLevel: 'h3',
				children: body
			}
		});
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /DATA_LOG/i })).toHaveAttribute(
				'aria-expanded',
				'false'
			);
		});
		const region = document.getElementById('chaos-panel-description-body');
		expect(region!.classList.contains('hidden')).toBe(true);
	});

	it('toggles open state, aria-expanded, hidden class, and localStorage', async () => {
		render(CollapsiblePanel, {
			props: {
				title: 'SYSTEM_PARAMETERS',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body',
				children: body
			}
		});
		const toggle = await screen.findByRole('button', { name: /SYSTEM_PARAMETERS/i });
		await fireEvent.click(toggle);
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(
			document.getElementById('chaos-panel-parameters-body')!.classList.contains('hidden')
		).toBe(true);
		expect(localStorage.getItem(PANEL_STORAGE_KEYS.parameters)).toBe('false');
		await fireEvent.click(toggle);
		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		expect(localStorage.getItem(PANEL_STORAGE_KEYS.parameters)).toBe('true');
	});

	it('wires aria-controls to bodyId', async () => {
		render(CollapsiblePanel, {
			props: {
				title: 'SYSTEM_PARAMETERS',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body',
				children: body
			}
		});
		const toggle = await screen.findByRole('button', { name: /SYSTEM_PARAMETERS/i });
		expect(toggle).toHaveAttribute('aria-controls', 'chaos-panel-parameters-body');
	});

	it('moves focus to the toggle when collapsing while focus is inside the body', async () => {
		render(CollapsiblePanel, {
			props: {
				title: 'SYSTEM_PARAMETERS',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body',
				children: body
			}
		});
		const inside = await screen.findByTestId('inside-body');
		inside.focus();
		expect(document.activeElement).toBe(inside);
		const toggle = screen.getByRole('button', { name: /SYSTEM_PARAMETERS/i });
		await fireEvent.click(toggle);
		expect(document.activeElement).toBe(toggle);
	});

	it('keeps unique body ids and live-syncs two panels on the same storageKey', async () => {
		const { container } = render(CollapsiblePanel, {
			props: {
				title: 'LEFT',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body-left',
				titleLevel: 'h3',
				children: body
			}
		});
		// Second instance in the same document
		const mount = document.createElement('div');
		container.appendChild(mount);
		const { unmount } = render(CollapsiblePanel, {
			target: mount,
			props: {
				title: 'RIGHT',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body-right',
				titleLevel: 'h3',
				children: body
			}
		});

		expect(document.getElementById('chaos-panel-parameters-body-left')).toBeTruthy();
		expect(document.getElementById('chaos-panel-parameters-body-right')).toBeTruthy();
		expect(document.querySelectorAll('#chaos-panel-parameters-body-left').length).toBe(1);
		expect(document.querySelectorAll('#chaos-panel-parameters-body-right').length).toBe(1);

		const leftToggle = screen.getByRole('button', { name: /LEFT/i });
		const rightToggle = screen.getByRole('button', { name: /RIGHT/i });
		await fireEvent.click(leftToggle);
		await waitFor(() => {
			expect(leftToggle).toHaveAttribute('aria-expanded', 'false');
			expect(rightToggle).toHaveAttribute('aria-expanded', 'false');
		});
		unmount();
	});

	it('re-seeds from localStorage after unmount eviction', async () => {
		const first = render(CollapsiblePanel, {
			props: {
				title: 'SYSTEM_PARAMETERS',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body',
				children: body
			}
		});
		const toggle = await screen.findByRole('button', { name: /SYSTEM_PARAMETERS/i });
		await fireEvent.click(toggle);
		expect(localStorage.getItem(PANEL_STORAGE_KEYS.parameters)).toBe('false');
		first.unmount();
		cleanup();

		// Other-tab style overwrite while unmounted
		localStorage.setItem(PANEL_STORAGE_KEYS.parameters, 'true');
		resetPanelOpenStoresForTests(); // ensure map empty if unmount race; eviction should already clear

		render(CollapsiblePanel, {
			props: {
				title: 'SYSTEM_PARAMETERS',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body',
				children: body
			}
		});
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /SYSTEM_PARAMETERS/i })).toHaveAttribute(
				'aria-expanded',
				'true'
			);
		});
	});
});
