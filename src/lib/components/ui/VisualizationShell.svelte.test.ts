import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
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

// Mock saved-config-loader so we can drive the inline `?config=` path
// (synchronous, no fetch) and control success/failure payloads.
const parseConfigParamMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/saved-config-loader', () => ({
	loadSavedConfigParameters: vi.fn(),
	loadSharedConfigParameters: vi.fn(),
	parseConfigParam: parseConfigParamMock
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
		parseConfigParamMock.mockReset();
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

	it('renders the afterDescription slot inside the description panel when provided', () => {
		const afterDescription = createRawSnippet(() => ({
			render: () => '<div data-testid="after-desc">extra</div>'
		}));
		render(VisualizationShell, {
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
				afterDescription,
				...authedPageProps
			} as never
		});
		expect(screen.getByTestId('after-desc')).toBeInTheDocument();
	});

	// --- Shell-level stability / error / URL wiring ---

	it('shows UNSTABLE_PARAMETERS_DETECTED when an inline config loads out-of-range params', async () => {
		// a: 99 is far outside the henon stable range [0, 2]; the shell must
		// check stability against the RAW loaded params (pre-clamp), not the
		// clamped slider values, so the warning still surfaces.
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'henon',
				a: 99,
				b: 0.3,
				iterations: 2000
			}
		});

		setMockPageUrl('http://localhost/henon?config=encoded-data');
		renderShell();

		await waitFor(() => {
			expect(screen.getByText('UNSTABLE_PARAMETERS_DETECTED')).toBeInTheDocument();
		});
	});

	it('shows INVALID_CONFIGURATION when an inline config fails to parse', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: false,
			error: 'Failed to parse configuration parameters',
			errors: ['Bad henon params'],
			logMessage: 'err',
			logDetails: {}
		});

		setMockPageUrl('http://localhost/henon?config=bad-data');
		renderShell();

		await waitFor(() => {
			expect(screen.getByText('INVALID_CONFIGURATION')).toBeInTheDocument();
		});
	});

	it('clamps the slider to its bounds when an inline config loads an out-of-range value', async () => {
		parseConfigParamMock.mockReturnValueOnce({
			ok: true,
			parameters: {
				type: 'henon',
				a: 99,
				b: 0.3,
				iterations: 2000
			}
		});

		setMockPageUrl('http://localhost/henon?config=encoded-data');
		const { container } = renderShell();

		await waitFor(() => {
			const input = container.querySelector('input[id="a"]') as HTMLInputElement;
			// Slider max is 1.5 — the raw value 99 must be clamped to 1.500
			expect(input.value).toBe('1.5');
			expect(screen.getByText('1.500')).toBeInTheDocument();
		});
	});

	it('renders a comparison link whose href reflects the current slider values', async () => {
		const { container } = renderShell();
		const link = screen.getByRole('link', { name: '⊞ Compare' }) as HTMLAnchorElement;
		expect(link.href).toContain('/henon/compare');

		// Capture the encoded `left` param at the default `a` value (1.4).
		const beforeUrl = new URL(link.href);
		const beforeLeft = beforeUrl.searchParams.get('left');
		expect(beforeLeft).toBeTruthy();

		// Changing the slider must update the comparison URL via $derived.
		const input = container.querySelector('input[id="a"]') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '1.2' } });

		const afterUrl = new URL(link.href);
		const afterLeft = afterUrl.searchParams.get('left');
		expect(afterUrl.href).toContain('/henon/compare');
		// A broken $derived would leave the encoded value unchanged.
		expect(afterLeft).not.toBe(beforeLeft);
	});
});
