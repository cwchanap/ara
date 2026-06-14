import { test, expect } from '@playwright/test';

test.describe('Double Pendulum', () => {
	test('homepage card links to the double pendulum module', async ({ page }) => {
		await page.goto('/');
		const link = page.getByRole('link', { name: /Double Pendulum/i });
		await expect(link).toBeVisible();
		await link.click();
		await expect(page).toHaveURL(/\/double-pendulum/);
		await expect(page.locator('canvas').first()).toBeVisible();
	});

	test('controls drive the simulation', async ({ page }) => {
		await page.goto('/double-pendulum');
		await expect(page.locator('canvas').first()).toBeVisible();

		// Pause then play.
		await page.getByTestId('toggle-play').click();
		await page.getByTestId('toggle-play').click();

		// Reset and randomize do not throw and keep the canvas alive.
		await page.getByTestId('reset').click();
		await page.getByTestId('randomize').click();
		await expect(page.locator('canvas').first()).toBeVisible();

		// Trail toggle.
		await page.getByTestId('toggle-trail').click();

		// Comparison mode reveals the divergence readout.
		await page.getByTestId('toggle-compare').click();
		await expect(page.getByTestId('divergence-readout')).toBeVisible();
	});

	test('remains usable at a mobile viewport', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/double-pendulum');
		await expect(page.locator('canvas').first()).toBeVisible();
		await expect(page.getByTestId('toggle-play')).toBeVisible();
	});
});
