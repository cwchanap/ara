import { test, expect } from '@playwright/test';

async function setRangeValue(
	locator: ReturnType<import('@playwright/test').Page['locator']>,
	value: number
) {
	await locator.evaluate((el, nextValue) => {
		if (!(el instanceof HTMLInputElement)) return;
		el.value = String(nextValue);
		el.dispatchEvent(new Event('input', { bubbles: true }));
	}, value);
}

test.describe('Lozi Map Page', () => {
	test('homepage displays Lozi Map card', async ({ page }) => {
		await page.goto('/');

		// Check that the Lozi card is visible
		await expect(page.getByRole('heading', { name: 'Lozi Map' })).toBeVisible();

		// Check that the description is present
		await expect(page.getByText(/piecewise-linear.*Hénon/i)).toBeVisible();
	});

	test('navigates to Lozi page from homepage', async ({ page }) => {
		await page.goto('/');

		// Click on the Lozi Map card
		await page.getByRole('link', { name: /Lozi Map/i }).click();

		// Verify navigation to the Lozi page
		await expect(page).toHaveURL('/lozi');
	});

	test('Lozi page has correct title', async ({ page }) => {
		await page.goto('/lozi');

		// Check for the main heading (exact match to avoid matching DATA_LOG: LOZI_MAP)
		await expect(page.getByRole('heading', { name: 'LOZI_MAP', exact: true })).toBeVisible();
	});

	test('Lozi page has parameter controls', async ({ page }) => {
		await page.goto('/lozi');

		// Check for parameter sliders (use exact match to avoid ambiguity)
		await expect(page.getByRole('slider', { name: 'a', exact: true })).toBeVisible();
		await expect(page.getByRole('slider', { name: 'b', exact: true })).toBeVisible();
		await expect(page.getByRole('slider', { name: 'x₀' })).toBeVisible();
		await expect(page.getByRole('slider', { name: 'y₀' })).toBeVisible();
		await expect(page.getByRole('slider', { name: 'Iterations' })).toBeVisible();
	});

	test('Lozi page displays mathematical equations', async ({ page }) => {
		await page.goto('/lozi');

		// Check for the Lozi equations
		await expect(page.getByText(/x\(n\+1\).*1.*y\(n\).*a.*\|x\(n\)\|/)).toBeVisible();
		await expect(page.getByText(/y\(n\+1\).*b.*x\(n\)/)).toBeVisible();
	});

	test('Lozi page has visualization container', async ({ page }) => {
		await page.goto('/lozi');

		// Visualization is rendered as an SVG plot
		await expect(page.locator('svg').first()).toBeVisible();
	});

	test('Lozi page has Save button', async ({ page }) => {
		await page.goto('/lozi');

		// Check for Save button
		await expect(page.getByRole('button', { name: /Save/i })).toBeVisible();
	});

	test('Lozi page has Return link', async ({ page }) => {
		await page.goto('/lozi');

		// Check for Return button/link
		await expect(page.getByRole('link', { name: /Return/i })).toBeVisible();
	});

	test('parameter sliders are interactive', async ({ page }) => {
		await page.goto('/lozi');

		const aSlider = page.getByRole('slider', { name: 'a', exact: true });
		const aValueDisplay = aSlider.locator(
			'xpath=ancestor::div[contains(@class, "space-y-2")]//span[contains(@class, "font-mono")]'
		);

		// Verify initial value display (a defaults to 0.5)
		await expect(aValueDisplay).toHaveText('0.500');

		// Change the slider value to 1.5
		await setRangeValue(aSlider, 1.5);

		// Verify the slider value attribute changed
		await expect(aSlider).toHaveValue('1.5');

		// Verify the scoped value display updated
		await expect(aValueDisplay).toHaveText('1.500');
	});

	test('Return link navigates back to homepage', async ({ page }) => {
		await page.goto('/lozi');

		await page.getByRole('link', { name: /Return/i }).click();

		await expect(page).toHaveURL('/');
	});

	test('info panel contains Lozi description', async ({ page }) => {
		await page.goto('/lozi');

		// Check for informational content about Lozi
		await expect(page.getByText(/René Lozi|piecewise-linear|1978/i)).toBeVisible();
	});

	test('visualization renders points', async ({ page }) => {
		await page.goto('/lozi');

		// Wait for SVG to be rendered with circles (D3.js scatter plot)
		await expect(page.locator('svg circle').first()).toBeVisible({ timeout: 5000 });

		// Read the iterations parameter from the page and compute expected minimum
		const iterations = await page.evaluate(() => {
			const slider = document.getElementById('iterations') as HTMLInputElement;
			return slider ? parseInt(slider.value, 10) : 2000; // Default if not found
		});

		// Verify multiple points are rendered (allowing for some points to be outside visible range)
		const circleCount = await page.locator('svg circle').count();
		const expectedMinimum = Math.max(10, Math.floor(iterations * 0.8));
		expect(circleCount).toBeGreaterThan(expectedMinimum);
	});
});
