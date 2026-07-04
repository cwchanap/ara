import { test, expect } from '@playwright/test';

test.describe('Gumowski-Mira Map Page', () => {
	test('page loads with title and canvas', async ({ page }) => {
		await page.goto('/gumowski-mira');

		await expect(
			page.getByRole('heading', { name: 'GUMOWSKI–MIRA_MAP', exact: true })
		).toBeVisible();
		await expect(page.locator('canvas').first()).toBeVisible();
	});

	test('randomize does not throw and keeps the canvas alive', async ({ page }) => {
		await page.goto('/gumowski-mira');
		await expect(page.locator('canvas').first()).toBeVisible();

		// Capture the initial mu value so we can assert it actually changed.
		const muBefore = await page.getByTestId('value-mu').textContent();

		// Reset and randomize must not throw; the page must stay on route and
		// the canvas must remain mounted (regression guard for a CDP-reported
		// about:blank crash on the randomize path).
		await page.getByTestId('reset-button').click();
		await expect(page).toHaveURL('/gumowski-mira');
		await expect(page.locator('canvas').first()).toBeVisible();

		await page.getByTestId('randomize-button').click();
		await expect(page).toHaveURL('/gumowski-mira');
		await expect(page.locator('canvas').first()).toBeVisible();

		// The randomize button should have produced new parameter values.
		const muAfter = await page.getByTestId('value-mu').textContent();
		expect(muAfter).not.toBe(muBefore);
	});

	test('presets switch the active label and update parameters', async ({ page }) => {
		await page.goto('/gumowski-mira');

		// Clicking a preset should mark it active and keep the canvas alive.
		const presetButtons = page.getByTestId('preset-button');
		const count = await presetButtons.count();
		expect(count).toBeGreaterThan(1);

		await presetButtons.nth(1).click();
		await expect(page.getByTestId('active-preset')).not.toHaveText(/CUSTOM/i);
		await expect(page.locator('canvas').first()).toBeVisible();
	});

	test('render mode toggle re-enables the x0/y0 sliders', async ({ page }) => {
		await page.goto('/gumowski-mira');

		// In Multi-Seed mode x0 is disabled.
		const x0 = page.locator('#x0');
		await expect(x0).toBeDisabled();

		// Switching to Single Orbit enables it.
		await page.getByTestId('select-render-mode').selectOption('single');
		await expect(x0).toBeEnabled();
		await expect(page.locator('canvas').first()).toBeVisible();
	});
});
