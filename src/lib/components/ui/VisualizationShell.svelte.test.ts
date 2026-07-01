import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import {
	authedPageProps,
	resetMockPageStore,
	restoreFetch,
	setMockPageUrl,
	setupApiFetchMock
} from '$lib/components/testing/page-test-helpers';
import VisualizationShell from './VisualizationShell.svelte';
import type { ParamDef } from '$lib/viz/types';

vi.mock('$app/stores', async () => {
	const { mockPageStore } = await import('$lib/components/testing/page-test-helpers');
	return { page: mockPageStore };
});
vi.mock('$app/paths', async () => {
	const { BASE_PATH } = await import('$lib/components/testing/page-test-helpers');
	return { base: BASE_PATH };
});
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/components/ui/SaveConfigDialog.svelte', async () => ({
	default: (await import('$lib/components/testing/DialogStub.svelte')).default
}));
vi.mock('$lib/components/ui/ShareDialog.svelte', async () => ({
	default: (await import('$lib/components/testing/DialogStub.svelte')).default
}));
vi.mock('$lib/components/ui/SnapshotButton.svelte', async () => ({
	default: (await import('$lib/components/testing/StubComponent.svelte')).default
}));
vi.mock('$lib/components/ui/VisualizationAlerts.svelte', async () => ({
	default: (await import('$lib/components/testing/VisualizationAlertsStub.svelte')).default
}));

const defs: ParamDef[] = [
	{ key: 'a', label: 'a', min: 0.5, max: 1.5, step: 0.001, decimals: 3, default: 1.4 }
];
const renderer = createRawSnippet(() => ({ render: () => '<div data-testid="renderer"></div>' }));

function renderShell() {
	return render(VisualizationShell, {
		props: {
			mapType: 'henon',
			title: 'HÉNON_MAP',
			moduleNumber: '02',
			paramDefs: defs,
			buildParameters: (v: Record<string, number>) => ({
				type: 'henon',
				a: v.a,
				b: 0.3,
				iterations: 2000
			}),
			formula: ['x(n+1) = …'],
			description: { heading: 'DATA_LOG: HÉNON_MAP', body: 'desc' },
			isAuthenticated: true,
			renderer,
			...authedPageProps
		} as never
	});
}

describe('VisualizationShell', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		setupApiFetchMock();
		setMockPageUrl('http://localhost/henon');
	});
	afterEach(() => {
		vi.useRealTimers();
		restoreFetch();
		resetMockPageStore();
		cleanup();
	});

	it('renders title, the renderer snippet, and an auto slider from the schema', () => {
		const { container } = renderShell();
		expect(screen.getByText('HÉNON_MAP')).toBeInTheDocument();
		expect(screen.getByTestId('renderer')).toBeInTheDocument();
		expect(container.querySelector('input[id="a"]')).toBeTruthy();
	});

	it('updates the displayed value when the schema slider changes', async () => {
		const { container } = renderShell();
		const input = container.querySelector('input[id="a"]') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '1.2' } });
		expect(screen.getByText('1.200')).toBeInTheDocument();
	});
});
