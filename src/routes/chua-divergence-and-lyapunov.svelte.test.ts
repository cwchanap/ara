/**
 * Coverage for Chua page paths that need the REAL VisualizationAlerts and
 * timer flushing:
 *  - the debounced Lyapunov recompute body (lyapUpdater)
 *  - the renderer divergence bind + onDismissDiverged dismissal
 * The main chua-page-interactions suite mocks VisualizationAlerts (so the
 * dismiss button is absent) and does not flush timers; this file keeps the
 * real alert component and uses fake timers to exercise those paths.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
	createUnauthedPageData,
	resetMockPageStore,
	setMockPageUrl,
	unauthedPageProps
} from '$lib/components/testing/page-test-helpers';
import ChuaPage from './chua/+page.svelte';

const setMockPageUrlUnauthed = (url: string) => setMockPageUrl(url, createUnauthedPageData());

vi.mock('$app/stores', async () => {
	const { mockPageStore } = await import('$lib/components/testing/page-test-helpers');
	return { page: mockPageStore };
});

vi.mock('$app/paths', async () => {
	const { BASE_PATH } = await import('$lib/components/testing/page-test-helpers');
	return { base: BASE_PATH };
});

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

vi.mock('$lib/chua', () => ({
	calculateChua: vi.fn(() => ({ points: [{ x: 1, y: 2, z: 3 }], diverged: false })),
	computePoincareSection: vi.fn(() => [{ u: 1, v: 2 }]),
	estimateLargestLyapunov: vi.fn(() => ({
		value: 0.42,
		classification: 'chaotic',
		diverged: false
	}))
}));

vi.mock('$lib/components/ui/SaveConfigDialog.svelte', async () => {
	const module = await import('$lib/components/testing/DialogStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/ui/ShareDialog.svelte', async () => {
	const module = await import('$lib/components/testing/DialogStub.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/ui/SnapshotButton.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});

vi.mock('$lib/components/visualizations/ChuaRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/BindableAllStub.svelte');
	return { default: module.default };
});

describe('Chua page – Lyapunov debounce and divergence dismissal', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		resetMockPageStore('http://localhost/', createUnauthedPageData());
		cleanup();
	});

	it('runs the debounced Lyapunov recompute after the effect triggers', async () => {
		const { estimateLargestLyapunov } = await import('$lib/chua');
		setMockPageUrlUnauthed('http://localhost/chua');
		render(ChuaPage, { props: unauthedPageProps });

		// The mount effect calls lyapUpdater.trigger(); flush the debounce.
		await vi.runAllTimersAsync();

		expect(estimateLargestLyapunov).toHaveBeenCalled();
	});

	it('raises and dismisses the renderer divergence alert', async () => {
		setMockPageUrlUnauthed('http://localhost/chua');
		render(ChuaPage, { props: unauthedPageProps });

		// BindableAllStub exposes a button that flips its `diverged` bindable,
		// which propagates to the page's rendererDiverged via bind:diverged.
		const trigger = screen.getByTestId('stub-trigger-diverged');
		await fireEvent.click(trigger);

		// The real VisualizationAlerts renders the divergence toast.
		expect(screen.getByText(/numerical integration diverged/i)).toBeInTheDocument();

		// Dismiss it -> onDismissDiverged resets rendererDiverged.
		const dismissBtn = screen.getByRole('button', { name: /Dismiss divergence alert/i });
		await fireEvent.click(dismissBtn);

		expect(screen.queryByText(/numerical integration diverged/i)).not.toBeInTheDocument();
	});
});
