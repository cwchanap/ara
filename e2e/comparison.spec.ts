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

test.describe('Comparison Mode - URL State', () => {
	test('URL includes compare and encoded parameters', async ({ page }) => {
		await page.goto('/lorenz/compare');
		await page.waitForTimeout(500);
		const url = page.url();
		expect(url).toContain('compare=true');
		expect(url).toContain('left=');
		expect(url).toContain('right=');
	});

	test('changing parameters updates URL', async ({ page }) => {
		await page.goto('/henon/compare');
		await page.waitForTimeout(500);
		const initialUrl = page.url();

		const leftA = page.locator('#left-a');
		await setRangeValue(leftA, 1.1);
		await page.waitForTimeout(500);
		const newUrl = page.url();

		expect(newUrl).not.toBe(initialUrl);
	});

	test('URL state persists on page refresh', async ({ page }) => {
		await page.goto('/henon/compare');
		await page.waitForTimeout(300);

		const leftA = page.locator('#left-a');
		await setRangeValue(leftA, 1.25);
		await page.waitForTimeout(500);

		const urlBeforeRefresh = page.url();
		await page.reload();

		await expect(page).toHaveURL(urlBeforeRefresh);
		await expect(leftA).toHaveValue('1.25');
	});
});

test.describe('Comparison Mode - Swap Functionality', () => {
	test('swap button exchanges left and right parameters', async ({ page }) => {
		await page.goto('/henon/compare');
		await page.waitForTimeout(300);

		const leftA = page.locator('#left-a');
		const rightA = page.locator('#right-a');

		await setRangeValue(leftA, 1.1);
		await setRangeValue(rightA, 1.3);
		await page.waitForTimeout(300);

		await expect(leftA).toHaveValue('1.1');
		await expect(rightA).toHaveValue('1.3');

		await page.getByRole('button', { name: /Swap/i }).click();
		await page.waitForTimeout(300);

		await expect(leftA).toHaveValue('1.3');
		await expect(rightA).toHaveValue('1.1');
	});
});

test.describe('Comparison Mode - Cross-Map Integration', () => {
	test('different map types load comparison mode', async ({ page }) => {
		await page.goto('/standard/compare');
		await expect(page.getByText('LEFT_PARAMETERS')).toBeVisible();
		await expect(page.getByText('RIGHT_PARAMETERS')).toBeVisible();

		await page.goto('/chaos-esthetique/compare');
		await expect(page.getByText('LEFT_PARAMETERS')).toBeVisible();
		await expect(page.getByText('RIGHT_PARAMETERS')).toBeVisible();
	});
});
