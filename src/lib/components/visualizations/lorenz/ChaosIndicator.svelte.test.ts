// src/lib/components/visualizations/lorenz/ChaosIndicator.vitest.ts
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import ChaosIndicator from './ChaosIndicator.svelte';

describe('ChaosIndicator', () => {
	afterEach(() => cleanup());

	it('shows Chaotic for a positive exponent', () => {
		const { getByText } = render(ChaosIndicator, {
			props: { value: 0.9, classification: 'chaotic', diverged: false }
		});
		expect(getByText(/Chaotic/i)).toBeTruthy();
		expect(getByText(/\+0\.9/)).toBeTruthy();
	});

	it('shows Periodic / Quasi-periodic for a marginal exponent', () => {
		const { getByText } = render(ChaosIndicator, {
			props: { value: 0, classification: 'marginal', diverged: false }
		});
		expect(getByText(/Periodic/i)).toBeTruthy();
	});

	it('shows Unstable when diverged', () => {
		const { getByText } = render(ChaosIndicator, {
			props: { value: NaN, classification: 'marginal', diverged: true }
		});
		expect(getByText(/Unstable|diverged/i)).toBeTruthy();
	});

	it('shows Stable for a negative exponent', () => {
		const { getByText } = render(ChaosIndicator, {
			props: { value: -0.15, classification: 'stable', diverged: false }
		});
		expect(getByText(/Stable/i)).toBeTruthy();
		expect(getByText(/-0\.15/)).toBeTruthy();
	});

	it('shows — when value is infinite', () => {
		const { getByText } = render(ChaosIndicator, {
			props: { value: Infinity, classification: 'marginal', diverged: false }
		});
		expect(getByText(/—/)).toBeTruthy();
	});

	it('shows Unstable badge when diverged even with stable classification', () => {
		const { getByText } = render(ChaosIndicator, {
			props: { value: 1.0, classification: 'stable', diverged: true }
		});
		expect(getByText(/Unstable|diverged/i)).toBeTruthy();
		expect(getByText(/—/)).toBeTruthy();
	});
});
