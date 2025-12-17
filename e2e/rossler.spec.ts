import { test, expect } from '@playwright/test';

test.describe('Rössler Attractor Page', () => {
	test('homepage displays Rössler Attractor card', async ({ page }) => {
		await page.goto('/');

		// Check that the Rössler card is visible
		await expect(page.getByRole('heading', { name: 'Rössler Attractor' })).toBeVisible();

		// Check that the description is present
		await expect(page.getByText(/3D.*chaotic.*scroll/i)).toBeVisible();
	});

	test('navigates to Rössler page from homepage', async ({ page }) => {
		await page.goto('/');

		// Click on the Rössler Attractor card
		await page.getByRole('link', { name: /Rössler Attractor/i }).click();

		// Verify navigation to the Rössler page
		await expect(page).toHaveURL('/rossler');
	});

	test('Rössler page has correct title', async ({ page }) => {
		await page.goto('/rossler');

		// Check for the main heading
		await expect(page.getByRole('heading', { name: /RÖSSLER_ATTRACTOR/i })).toBeVisible();
	});

	test('Rössler page has parameter controls', async ({ page }) => {
		await page.goto('/rossler');

		// Check for parameter sliders (use exact label text)
		await expect(page.getByRole('slider', { name: 'a (parameter)' })).toBeVisible();
		await expect(page.getByRole('slider', { name: 'b (parameter)' })).toBeVisible();
		await expect(page.getByRole('slider', { name: 'c (parameter)' })).toBeVisible();
	});

	test('Rössler page displays mathematical equations', async ({ page }) => {
		await page.goto('/rossler');

		// Check for the Rössler equations
		await expect(page.getByText('dx/dt = -y - z')).toBeVisible();
		await expect(page.getByText(/dy\/dt = x \+ a/)).toBeVisible();
		await expect(page.getByText(/dz\/dt = b \+ z/)).toBeVisible();
	});

	test('Rössler page has visualization container', async ({ page }) => {
		await page.goto('/rossler');

		// Check for the Three.js visualization label
		await expect(page.getByText(/LIVE_RENDER.*THREE\.JS/i)).toBeVisible();
	});

	test('Rössler page has Save button', async ({ page }) => {
		await page.goto('/rossler');

		// Check for Save button
		await expect(page.getByRole('button', { name: /Save/i })).toBeVisible();
	});

	test('Rössler page has Return link', async ({ page }) => {
		await page.goto('/rossler');

		// Check for Return button/link
		await expect(page.getByRole('link', { name: /Return/i })).toBeVisible();
	});

	test('parameter sliders are interactive', async ({ page }) => {
		await page.goto('/rossler');

		// Find the 'c' parameter slider and change its value
		const cSlider = page.locator('input[type="range"]').nth(2); // c is the third slider

		// Get initial value display
		const initialValue = await page.getByText(/5\.70/).textContent();
		expect(initialValue).toContain('5.70');

		// Change the slider value
		await cSlider.fill('10');

		// Verify the value changed
		await expect(page.getByText(/10\.00/)).toBeVisible();
	});

	test('Return link navigates back to homepage', async ({ page }) => {
		await page.goto('/rossler');

		await page.getByRole('link', { name: /Return/i }).click();

		await expect(page).toHaveURL('/');
	});

	test('info panel contains Rössler description', async ({ page }) => {
		await page.goto('/rossler');

		// Check for informational content about Rössler
		await expect(page.getByText(/Otto Rössler|Rössler attractor|1970s/i)).toBeVisible();
	});
});
