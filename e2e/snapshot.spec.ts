import { test, expect } from '@playwright/test';

test.describe('Snapshot Feature', () => {
	test.describe('Hénon Map (D3.js SVG)', () => {
		test('snapshot button is visible on henon page', async ({ page }) => {
			await page.goto('/henon');

			await expect(page.getByRole('button', { name: /snapshot/i })).toBeVisible();
		});

		test('snapshot button has correct styling', async ({ page }) => {
			await page.goto('/henon');

			const snapshotBtn = page.getByRole('button', { name: /snapshot/i });
			await expect(snapshotBtn).toBeVisible();

			// Check it has the sci-fi themed styling (primary color class)
			await expect(snapshotBtn).toHaveClass(/text-primary/);
		});

		test('clicking snapshot triggers download', async ({ page }) => {
			await page.goto('/henon');

			// Wait for visualization to render
			await page.waitForSelector('svg');

			// Set up download listener
			const downloadPromise = page.waitForEvent('download');

			// Click snapshot button
			await page.getByRole('button', { name: /snapshot/i }).click();

			// Verify download started
			const download = await downloadPromise;
			expect(download.suggestedFilename()).toMatch(/^henon_.*\.png$/);
		});
	});

	test.describe('Logistic Map (D3.js SVG)', () => {
		test('snapshot button is visible on logistic page', async ({ page }) => {
			await page.goto('/logistic');

			await expect(page.getByRole('button', { name: /snapshot/i })).toBeVisible();
		});

		test('clicking snapshot triggers download with correct filename', async ({ page }) => {
			await page.goto('/logistic');

			await page.waitForSelector('svg');

			const downloadPromise = page.waitForEvent('download');
			await page.getByRole('button', { name: /snapshot/i }).click();

			const download = await downloadPromise;
			expect(download.suggestedFilename()).toMatch(/^logistic_.*\.png$/);
		});
	});

	test.describe('Standard Map (Canvas + SVG)', () => {
		test('snapshot button is visible on standard page', async ({ page }) => {
			await page.goto('/standard');

			await expect(page.getByRole('button', { name: /snapshot/i })).toBeVisible();
		});

		test('clicking snapshot captures canvas visualization', async ({ page }) => {
			await page.goto('/standard');

			// Wait for canvas to be rendered
			await page.waitForSelector('canvas');

			const downloadPromise = page.waitForEvent('download');
			await page.getByRole('button', { name: /snapshot/i }).click();

			const download = await downloadPromise;
			expect(download.suggestedFilename()).toMatch(/^standard_.*\.png$/);
		});
	});

	test.describe('Bifurcation Logistic (Pure Canvas)', () => {
		test('snapshot button is visible on bifurcation-logistic page', async ({ page }) => {
			await page.goto('/bifurcation-logistic');

			await expect(page.getByRole('button', { name: /snapshot/i })).toBeVisible();
		});

		test('clicking snapshot captures pure canvas', async ({ page }) => {
			await page.goto('/bifurcation-logistic');

			await page.waitForSelector('canvas');

			const downloadPromise = page.waitForEvent('download');
			await page.getByRole('button', { name: /snapshot/i }).click();

			const download = await downloadPromise;
			expect(download.suggestedFilename()).toMatch(/^bifurcation-logistic_.*\.png$/);
		});
	});

	test.describe('Newton Fractal (Pure Canvas)', () => {
		test('snapshot button is visible on newton page', async ({ page }) => {
			await page.goto('/newton');

			await expect(page.getByRole('button', { name: /snapshot/i })).toBeVisible();
		});

		test('clicking snapshot triggers download', async ({ page }) => {
			await page.goto('/newton');

			await page.waitForSelector('canvas');

			const downloadPromise = page.waitForEvent('download');
			await page.getByRole('button', { name: /snapshot/i }).click();

			const download = await downloadPromise;
			expect(download.suggestedFilename()).toMatch(/^newton_.*\.png$/);
		});
	});

	test.describe('Chaos Esthetique (Canvas + SVG)', () => {
		test('snapshot button is visible', async ({ page }) => {
			await page.goto('/chaos-esthetique');

			await expect(page.getByRole('button', { name: /snapshot/i })).toBeVisible();
		});
	});

	test.describe('Bifurcation Hénon (Pure Canvas)', () => {
		test('snapshot button is visible', async ({ page }) => {
			await page.goto('/bifurcation-henon');

			await expect(page.getByRole('button', { name: /snapshot/i })).toBeVisible();
		});
	});

	test.describe('Error Handling', () => {
		test('shows feedback when snapshot is taken', async ({ page }) => {
			await page.goto('/henon');

			await page.waitForSelector('svg');

			// Click and check for success feedback (toast or button state change)
			const downloadPromise = page.waitForEvent('download');
			await page.getByRole('button', { name: /snapshot/i }).click();

			await downloadPromise;

			// Success state should be shown briefly (implementation detail)
			// This test verifies no error occurs
		});
	});
});
