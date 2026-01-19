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

test.describe('Comparison Mode - Navigation', () => {
	test('can navigate to Lorenz comparison page directly', async ({ page }) => {
		await page.goto('/lorenz/compare');
		await expect(page).toHaveURL(/\/lorenz\/compare/);
	});

	test('can navigate to Henon comparison page directly', async ({ page }) => {
		await page.goto('/henon/compare');
		await expect(page).toHaveURL(/\/henon\/compare/);
	});

	test('can navigate to Logistic comparison page directly', async ({ page }) => {
		await page.goto('/logistic/compare');
		await expect(page).toHaveURL(/\/logistic\/compare/);
	});

	test('can navigate to Standard comparison page directly', async ({ page }) => {
		await page.goto('/standard/compare');
		await expect(page).toHaveURL(/\/standard\/compare/);
	});
});

test.describe('Comparison Mode - Lorenz Layout', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/lorenz/compare');
	});

	test('displays comparison header with map name', async ({ page }) => {
		await expect(page.getByRole('heading', { name: /LORENZ.*COMPARE/i })).toBeVisible();
	});

	test('displays left and right parameter panels', async ({ page }) => {
		await expect(page.getByText('LEFT_PARAMETERS')).toBeVisible();
		await expect(page.getByText('RIGHT_PARAMETERS')).toBeVisible();
	});

	test('has Exit Comparison button', async ({ page }) => {
		await expect(page.getByRole('link', { name: /Exit Comparison/i })).toBeVisible();
	});

	test('has Swap button', async ({ page }) => {
		await expect(page.getByRole('button', { name: /Swap/i })).toBeVisible();
	});

	test('Exit Comparison navigates to single view', async ({ page }) => {
		await page.getByRole('link', { name: /Exit Comparison/i }).click();
		await expect(page).toHaveURL('/lorenz');
	});
});

test.describe('Comparison Mode - Henon Parameter Controls', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/henon/compare');
	});

	test('has parameter sliders for left panel', async ({ page }) => {
		await expect(page.locator('#left-a')).toBeVisible();
		await expect(page.locator('#left-b')).toBeVisible();
		await expect(page.locator('#left-iterations')).toBeVisible();
	});

	test('has parameter sliders for right panel', async ({ page }) => {
		await expect(page.locator('#right-a')).toBeVisible();
		await expect(page.locator('#right-b')).toBeVisible();
		await expect(page.locator('#right-iterations')).toBeVisible();
	});

	test('left and right panels have independent parameter values', async ({ page }) => {
		const leftA = page.locator('#left-a');
		const rightA = page.locator('#right-a');

		// Set different values
		await setRangeValue(leftA, 1.2);
		await setRangeValue(rightA, 1.5);

		// Verify they have different values
		await expect(leftA).toHaveValue('1.2');
		await expect(rightA).toHaveValue('1.5');
	});
});

test.describe('Comparison Mode - URL State', () => {
	test('URL includes compare=true parameter', async ({ page }) => {
		await page.goto('/lorenz/compare');
		// Wait for URL to update with state
		await page.waitForTimeout(500);
		await expect(page).toHaveURL(/compare=true/);
	});

	test('URL includes left and right encoded parameters', async ({ page }) => {
		await page.goto('/lorenz/compare');
		// Wait for URL to update with state
		await page.waitForTimeout(500);
		const url = page.url();
		expect(url).toContain('left=');
		expect(url).toContain('right=');
	});

	test('changing parameters updates URL', async ({ page }) => {
		await page.goto('/henon/compare');
		await page.waitForTimeout(500);
		const initialUrl = page.url();

		// Change a parameter
		const leftA = page.locator('#left-a');
		await setRangeValue(leftA, 1.1);

		// Wait for debounced URL update
		await page.waitForTimeout(500);
		const newUrl = page.url();

		expect(newUrl).not.toBe(initialUrl);
	});

	test('URL state is preserved on page refresh', async ({ page }) => {
		await page.goto('/henon/compare');
		await page.waitForTimeout(300);

		// Set specific values
		const leftA = page.locator('#left-a');
		await setRangeValue(leftA, 1.25);
		await page.waitForTimeout(500);

		// Capture URL and reload
		const urlBeforeRefresh = page.url();
		await page.reload();

		// URL should be preserved
		await expect(page).toHaveURL(urlBeforeRefresh);

		// Value should be restored
		await expect(leftA).toHaveValue('1.25');
	});
});

test.describe('Comparison Mode - Swap Functionality', () => {
	test('swap button exchanges left and right parameters', async ({ page }) => {
		await page.goto('/henon/compare');
		await page.waitForTimeout(300);

		// Set distinct values for left and right
		const leftA = page.locator('#left-a');
		const rightA = page.locator('#right-a');

		await setRangeValue(leftA, 1.1);
		await setRangeValue(rightA, 1.3);
		await page.waitForTimeout(300);

		// Verify initial values
		await expect(leftA).toHaveValue('1.1');
		await expect(rightA).toHaveValue('1.3');

		// Click swap
		await page.getByRole('button', { name: /Swap/i }).click();
		await page.waitForTimeout(300);

		// Values should be swapped
		await expect(leftA).toHaveValue('1.3');
		await expect(rightA).toHaveValue('1.1');
	});
});

test.describe('Comparison Mode - Visualization Rendering', () => {
	test('Henon comparison renders two visualizations', async ({ page }) => {
		await page.goto('/henon/compare');

		// Both panels should have SVG visualizations
		const svgs = page.locator('svg');
		await expect(svgs.first()).toBeVisible({ timeout: 5000 });

		// Should have at least 2 SVGs (one per panel, plus possible axes)
		const svgCount = await svgs.count();
		expect(svgCount).toBeGreaterThanOrEqual(2);
	});

	test('Logistic comparison renders two visualizations', async ({ page }) => {
		await page.goto('/logistic/compare');

		// Both panels should render
		const svgs = page.locator('svg');
		await expect(svgs.first()).toBeVisible({ timeout: 5000 });
		const svgCount = await svgs.count();
		expect(svgCount).toBeGreaterThanOrEqual(2);
	});

	test('Lorenz comparison renders two Three.js canvases', async ({ page }) => {
		await page.goto('/lorenz/compare');

		// Three.js renders to canvas elements
		const canvases = page.locator('canvas');
		await expect(canvases.first()).toBeVisible({ timeout: 5000 });

		// Should have at least 2 canvases
		const canvasCount = await canvases.count();
		expect(canvasCount).toBeGreaterThanOrEqual(2);
	});
});

test.describe('Comparison Mode - Different Map Types', () => {
	const mapTypes = [
		{ path: '/lozi/compare', name: 'Lozi' },
		{ path: '/newton/compare', name: 'Newton' },
		{ path: '/standard/compare', name: 'Standard' },
		{ path: '/bifurcation-logistic/compare', name: 'Bifurcation Logistic' },
		{ path: '/bifurcation-henon/compare', name: 'Bifurcation Henon' },
		{ path: '/chaos-esthetique/compare', name: 'Chaos Esthetique' },
		{ path: '/lyapunov/compare', name: 'Lyapunov' }
	];

	for (const { path, name } of mapTypes) {
		test(`${name} comparison page loads successfully`, async ({ page }) => {
			await page.goto(path);
			await expect(page.getByText('LEFT_PARAMETERS')).toBeVisible();
			await expect(page.getByText('RIGHT_PARAMETERS')).toBeVisible();
		});
	}
});

test.describe('Comparison Mode - 3D Camera Sync (Lorenz)', () => {
	test('camera sync toggle is visible for 3D visualizations', async ({ page }) => {
		await page.goto('/lorenz/compare');

		// Camera sync should be available for 3D maps
		await expect(page.getByText(/Camera Sync/i)).toBeVisible();
	});

	test('camera sync toggle for Rossler comparison', async ({ page }) => {
		await page.goto('/rossler/compare');

		// Camera sync should be available for 3D maps
		await expect(page.getByText(/Camera Sync/i)).toBeVisible();
	});
});
