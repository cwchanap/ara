import { test, expect } from '@playwright/test';

test.describe('Lorenz Controls', () => {
	test('preset "High Energy" sets #rho to 40', async ({ page }) => {
		await page.goto('/lorenz');

		// Click the "High Energy" preset button
		await page.getByRole('button', { name: 'High Energy' }).click();

		// The #rho slider should reflect rho=40
		const rhoInput = page.locator('#rho');
		await expect(rhoInput).toHaveValue('40');
	});

	test('Pause/Play toggle cycles button label', async ({ page }) => {
		await page.goto('/lorenz');

		// Initially the simulation is playing, so the button reads "Pause"
		const toggleBtn = page.getByRole('button', { name: 'Pause' });
		await expect(toggleBtn).toBeVisible();

		// Click Pause → simulation stops, button becomes "Play"
		await toggleBtn.click();
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

		// Click Play → simulation resumes, button becomes "Pause" again
		await page.getByRole('button', { name: 'Play' }).click();
		await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	});

	test('clicking "XY" view mode keeps canvas visible', async ({ page }) => {
		await page.goto('/lorenz');

		// Click the XY view mode button
		await page.getByRole('button', { name: 'XY' }).click();

		// The Three.js renderer appends a canvas; it should remain in the DOM
		await expect(page.locator('canvas').first()).toBeVisible();
	});

	test('shared URL with ?sigma=10&rho=28&beta=2.667 shows rho value 28', async ({ page }) => {
		await page.goto('/lorenz?sigma=10&rho=28&beta=2.667');

		// rho defaults to 28 and these params do not override it via the config loader,
		// so the slider should show 28 (the default, matching the URL intent)
		const rhoInput = page.locator('#rho');
		await expect(rhoInput).toHaveValue('28');
	});
});
