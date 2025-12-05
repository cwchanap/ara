import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
	test('should display the home page with visualization cards', async ({ page }) => {
		await page.goto('/');

		// Check that the page title contains expected text
		await expect(page).toHaveTitle(/Chaos/i);

		// Check that visualization cards are present (using heading elements for precision)
		await expect(page.getByRole('heading', { name: 'Lorenz Attractor' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Hénon Map' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Logistic Map' })).toBeVisible();
	});

	test('should navigate to Lorenz visualization page', async ({ page }) => {
		await page.goto('/');

		// Click on the Lorenz Attractor card link
		await page.getByRole('link', { name: /Lorenz Attractor/i }).click();

		// Verify navigation to the Lorenz page
		await expect(page).toHaveURL('/lorenz');
	});
});
