/**
 * Tests for constants.ts
 *
 * Validates that exported constants have correct values and satisfy
 * important invariants (ranges, types, relationships).
 */

import { describe, expect, test } from 'bun:test';
import {
	SLIDER_DEBOUNCE_MS,
	TOAST_SUCCESS_DURATION_MS,
	TOAST_ERROR_DURATION_MS,
	TOAST_WARNING_DURATION_MS,
	CONFIG_NAME_MAX_LENGTH,
	MAX_DECODED_CONFIG_PARAM_LENGTH,
	MAX_JSON_NESTING_DEPTH,
	MAX_LOG_MESSAGE_LENGTH,
	DEFAULT_MAX_ITERATIONS,
	MAX_WORKER_POINTS,
	VIZ_CONTAINER_HEIGHT,
	LORENZ_STEPS,
	LORENZ_DT,
	AUTO_ROTATE_SPEED,
	D3_CHART_MARGIN,
	COLOR_PRIMARY,
	COLOR_SECONDARY,
	HTTP_STATUS,
	SHARE_CODE_LENGTH,
	SHARE_CODE_CHARSET,
	SHARE_RATE_LIMIT_PER_HOUR,
	SHARE_EXPIRATION_DAYS,
	SHARE_CODE_MAX_RETRIES,
	DEBOUNCE_MS,
	CAMERA_SYNC_DEBOUNCE_MS
} from './constants';

describe('UI timing constants', () => {
	test('SLIDER_DEBOUNCE_MS is a positive number', () => {
		expect(SLIDER_DEBOUNCE_MS).toBeGreaterThan(0);
		expect(typeof SLIDER_DEBOUNCE_MS).toBe('number');
	});

	test('DEBOUNCE_MS is a positive number', () => {
		expect(DEBOUNCE_MS).toBeGreaterThan(0);
		expect(typeof DEBOUNCE_MS).toBe('number');
	});

	test('CAMERA_SYNC_DEBOUNCE_MS is a positive number', () => {
		expect(CAMERA_SYNC_DEBOUNCE_MS).toBeGreaterThan(0);
		expect(typeof CAMERA_SYNC_DEBOUNCE_MS).toBe('number');
	});

	test('TOAST_SUCCESS_DURATION_MS is a positive number in milliseconds', () => {
		expect(TOAST_SUCCESS_DURATION_MS).toBeGreaterThan(0);
		// Should be at least 1 second (1000ms) and not absurdly long (60s)
		expect(TOAST_SUCCESS_DURATION_MS).toBeGreaterThanOrEqual(1000);
		expect(TOAST_SUCCESS_DURATION_MS).toBeLessThanOrEqual(60000);
	});

	test('TOAST_ERROR_DURATION_MS is longer than success duration', () => {
		// Errors should be shown longer to give users time to read them
		expect(TOAST_ERROR_DURATION_MS).toBeGreaterThanOrEqual(TOAST_SUCCESS_DURATION_MS);
	});

	test('TOAST_WARNING_DURATION_MS is a positive number', () => {
		expect(TOAST_WARNING_DURATION_MS).toBeGreaterThan(0);
		expect(TOAST_WARNING_DURATION_MS).toBeGreaterThanOrEqual(1000);
	});

	test('CAMERA_SYNC_DEBOUNCE_MS is less than DEBOUNCE_MS for smoother sync', () => {
		// Camera sync should be faster than general debounce
		expect(CAMERA_SYNC_DEBOUNCE_MS).toBeLessThan(DEBOUNCE_MS);
	});
});

describe('validation constants', () => {
	test('CONFIG_NAME_MAX_LENGTH is a positive integer', () => {
		expect(CONFIG_NAME_MAX_LENGTH).toBeGreaterThan(0);
		expect(Number.isInteger(CONFIG_NAME_MAX_LENGTH)).toBe(true);
	});

	test('CONFIG_NAME_MAX_LENGTH is reasonable (10-1000 chars)', () => {
		expect(CONFIG_NAME_MAX_LENGTH).toBeGreaterThanOrEqual(10);
		expect(CONFIG_NAME_MAX_LENGTH).toBeLessThanOrEqual(1000);
	});

	test('MAX_DECODED_CONFIG_PARAM_LENGTH is larger than a typical config', () => {
		// Must be large enough for a real configuration (at least a few KB)
		expect(MAX_DECODED_CONFIG_PARAM_LENGTH).toBeGreaterThan(1024);
	});

	test('MAX_JSON_NESTING_DEPTH is a reasonable depth limit', () => {
		expect(MAX_JSON_NESTING_DEPTH).toBeGreaterThan(0);
		expect(MAX_JSON_NESTING_DEPTH).toBeGreaterThanOrEqual(5);
		expect(MAX_JSON_NESTING_DEPTH).toBeLessThanOrEqual(100);
	});

	test('MAX_LOG_MESSAGE_LENGTH is a positive integer', () => {
		expect(MAX_LOG_MESSAGE_LENGTH).toBeGreaterThan(0);
		expect(Number.isInteger(MAX_LOG_MESSAGE_LENGTH)).toBe(true);
	});
});

describe('visualization constants', () => {
	test('DEFAULT_MAX_ITERATIONS is a positive integer', () => {
		expect(DEFAULT_MAX_ITERATIONS).toBeGreaterThan(0);
		expect(Number.isInteger(DEFAULT_MAX_ITERATIONS)).toBe(true);
	});

	test('MAX_WORKER_POINTS is greater than DEFAULT_MAX_ITERATIONS', () => {
		expect(MAX_WORKER_POINTS).toBeGreaterThan(DEFAULT_MAX_ITERATIONS);
	});

	test('VIZ_CONTAINER_HEIGHT is a positive integer in pixels', () => {
		expect(VIZ_CONTAINER_HEIGHT).toBeGreaterThan(0);
		expect(Number.isInteger(VIZ_CONTAINER_HEIGHT)).toBe(true);
	});

	test('LORENZ_STEPS is a positive integer', () => {
		expect(LORENZ_STEPS).toBeGreaterThan(0);
		expect(Number.isInteger(LORENZ_STEPS)).toBe(true);
	});

	test('LORENZ_DT is a small positive number for numerical stability', () => {
		expect(LORENZ_DT).toBeGreaterThan(0);
		expect(LORENZ_DT).toBeLessThan(0.1);
	});

	test('AUTO_ROTATE_SPEED is a positive number', () => {
		expect(AUTO_ROTATE_SPEED).toBeGreaterThan(0);
	});
});

describe('D3 chart margin', () => {
	test('all margins are non-negative numbers', () => {
		expect(D3_CHART_MARGIN.top).toBeGreaterThanOrEqual(0);
		expect(D3_CHART_MARGIN.right).toBeGreaterThanOrEqual(0);
		expect(D3_CHART_MARGIN.bottom).toBeGreaterThanOrEqual(0);
		expect(D3_CHART_MARGIN.left).toBeGreaterThanOrEqual(0);
	});

	test('has all four required margin properties', () => {
		expect(D3_CHART_MARGIN).toHaveProperty('top');
		expect(D3_CHART_MARGIN).toHaveProperty('right');
		expect(D3_CHART_MARGIN).toHaveProperty('bottom');
		expect(D3_CHART_MARGIN).toHaveProperty('left');
	});

	test('bottom and left margins are larger to accommodate axis labels', () => {
		// Axis labels typically require more space at bottom and left
		expect(D3_CHART_MARGIN.bottom).toBeGreaterThan(D3_CHART_MARGIN.top);
		expect(D3_CHART_MARGIN.left).toBeGreaterThan(D3_CHART_MARGIN.right);
	});
});

describe('color constants', () => {
	test('COLOR_PRIMARY is a valid hex color', () => {
		expect(COLOR_PRIMARY).toMatch(/^#[0-9a-fA-F]{6}$/);
	});

	test('COLOR_SECONDARY is a valid hex color', () => {
		expect(COLOR_SECONDARY).toMatch(/^#[0-9a-fA-F]{6}$/);
	});

	test('PRIMARY color is the neon cyan', () => {
		expect(COLOR_PRIMARY).toBe('#00f3ff');
	});

	test('SECONDARY color is the magenta/purple', () => {
		expect(COLOR_SECONDARY).toBe('#bc13fe');
	});

	test('PRIMARY and SECONDARY colors are different', () => {
		expect(COLOR_PRIMARY).not.toBe(COLOR_SECONDARY);
	});
});

describe('HTTP status codes', () => {
	test('OK is 200', () => {
		expect(HTTP_STATUS.OK).toBe(200);
	});

	test('CREATED is 201', () => {
		expect(HTTP_STATUS.CREATED).toBe(201);
	});

	test('BAD_REQUEST is 400', () => {
		expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
	});

	test('UNAUTHORIZED is 401', () => {
		expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
	});

	test('FORBIDDEN is 403', () => {
		expect(HTTP_STATUS.FORBIDDEN).toBe(403);
	});

	test('NOT_FOUND is 404', () => {
		expect(HTTP_STATUS.NOT_FOUND).toBe(404);
	});

	test('TOO_MANY_REQUESTS is 429', () => {
		expect(HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
	});

	test('GONE is 410', () => {
		expect(HTTP_STATUS.GONE).toBe(410);
	});

	test('INTERNAL_SERVER_ERROR is 500', () => {
		expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
	});

	test('success codes are in 2xx range', () => {
		expect(HTTP_STATUS.OK).toBeGreaterThanOrEqual(200);
		expect(HTTP_STATUS.OK).toBeLessThan(300);
		expect(HTTP_STATUS.CREATED).toBeGreaterThanOrEqual(200);
		expect(HTTP_STATUS.CREATED).toBeLessThan(300);
	});

	test('client error codes are in 4xx range', () => {
		const clientErrors = [
			HTTP_STATUS.BAD_REQUEST,
			HTTP_STATUS.UNAUTHORIZED,
			HTTP_STATUS.FORBIDDEN,
			HTTP_STATUS.NOT_FOUND,
			HTTP_STATUS.GONE,
			HTTP_STATUS.TOO_MANY_REQUESTS
		];
		for (const code of clientErrors) {
			expect(code).toBeGreaterThanOrEqual(400);
			expect(code).toBeLessThan(500);
		}
	});

	test('server error codes are in 5xx range', () => {
		expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBeGreaterThanOrEqual(500);
		expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBeLessThan(600);
	});
});

describe('share feature constants', () => {
	test('SHARE_CODE_LENGTH is a positive integer', () => {
		expect(SHARE_CODE_LENGTH).toBeGreaterThan(0);
		expect(Number.isInteger(SHARE_CODE_LENGTH)).toBe(true);
	});

	test('SHARE_CODE_CHARSET contains only URL-safe alphanumeric characters', () => {
		expect(SHARE_CODE_CHARSET).toMatch(/^[A-Za-z0-9]+$/);
	});

	test('SHARE_CODE_CHARSET has enough characters for entropy', () => {
		// Should have at least 36 chars (a-z + 0-9) for reasonable entropy
		expect(SHARE_CODE_CHARSET.length).toBeGreaterThanOrEqual(36);
	});

	test('SHARE_CODE_CHARSET has no duplicate characters', () => {
		const unique = new Set(SHARE_CODE_CHARSET.split(''));
		expect(unique.size).toBe(SHARE_CODE_CHARSET.length);
	});

	test('SHARE_RATE_LIMIT_PER_HOUR is a positive integer', () => {
		expect(SHARE_RATE_LIMIT_PER_HOUR).toBeGreaterThan(0);
		expect(Number.isInteger(SHARE_RATE_LIMIT_PER_HOUR)).toBe(true);
	});

	test('SHARE_EXPIRATION_DAYS is a positive integer', () => {
		expect(SHARE_EXPIRATION_DAYS).toBeGreaterThan(0);
		expect(Number.isInteger(SHARE_EXPIRATION_DAYS)).toBe(true);
	});

	test('SHARE_CODE_MAX_RETRIES is a positive integer', () => {
		expect(SHARE_CODE_MAX_RETRIES).toBeGreaterThan(0);
		expect(Number.isInteger(SHARE_CODE_MAX_RETRIES)).toBe(true);
	});
});
