/**
 * Centralized Constants
 *
 * This file contains all application-wide constants with documented limits.
 * Use these constants instead of magic numbers throughout the codebase.
 */

// ============================================================================
// UI Constants
// ============================================================================

/**
 * Debounce delay for parameter slider inputs (milliseconds).
 * Prevents excessive re-renders during slider manipulation.
 */
export const SLIDER_DEBOUNCE_MS = 50;

/**
 * Duration for success toast notifications (milliseconds).
 */
export const TOAST_SUCCESS_DURATION_MS = 3000;

/**
 * Duration for error toast notifications (milliseconds).
 */
export const TOAST_ERROR_DURATION_MS = 5000;

/**
 * Duration for warning toast notifications (milliseconds).
 */
export const TOAST_WARNING_DURATION_MS = 5000;

// ============================================================================
// Validation Constants
// ============================================================================

/**
 * Maximum length for configuration names.
 */
export const CONFIG_NAME_MAX_LENGTH = 100;

/**
 * Maximum decoded config parameter length for URL-based configs.
 * Prevents DoS via excessively large URL parameters.
 */
export const MAX_DECODED_CONFIG_PARAM_LENGTH = 50 * 1024; // 50KB

/**
 * Maximum JSON nesting depth for config parameters.
 * Prevents stack overflow from deeply nested JSON.
 */
export const MAX_JSON_NESTING_DEPTH = 20;

/**
 * Maximum log message length for truncation.
 */
export const MAX_LOG_MESSAGE_LENGTH = 2000;

// ============================================================================
// Visualization Limits
// ============================================================================

/**
 * Default maximum iterations for attractor calculations.
 */
export const DEFAULT_MAX_ITERATIONS = 5000;

/**
 * Maximum points limit for web worker computations.
 * Prevents memory exhaustion in heavy calculations.
 */
export const MAX_WORKER_POINTS = 100000;

/**
 * Default visualization container height (pixels).
 */
export const VIZ_CONTAINER_HEIGHT = 600;

// ============================================================================
// Three.js Constants
// ============================================================================

/**
 * Number of steps for Lorenz attractor calculation.
 */
export const LORENZ_STEPS = 15000;

/**
 * Time delta for Lorenz numerical integration.
 */
export const LORENZ_DT = 0.005;

/**
 * Auto-rotation speed for 3D visualizations.
 */
export const AUTO_ROTATE_SPEED = 0.5;

// ============================================================================
// D3.js Chart Constants
// ============================================================================

/**
 * Default chart margins for D3 visualizations.
 */
export const D3_CHART_MARGIN = {
	top: 20,
	right: 20,
	bottom: 50,
	left: 60
} as const;

/**
 * Primary accent color (neon cyan).
 */
export const COLOR_PRIMARY = '#00f3ff';

/**
 * Secondary accent color (magenta).
 */
export const COLOR_SECONDARY = '#bc13fe';

// ============================================================================
// API Constants
// ============================================================================

/**
 * HTTP status codes.
 */
export const HTTP_STATUS = {
	OK: 200,
	CREATED: 201,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	TOO_MANY_REQUESTS: 429,
	GONE: 410,
	INTERNAL_SERVER_ERROR: 500
} as const;

// ============================================================================
// Share Feature Constants
// ============================================================================

/**
 * Length of generated share short codes.
 * 8 alphanumeric chars = 62^8 ≈ 218 trillion combinations.
 */
export const SHARE_CODE_LENGTH = 8;

/**
 * Characters used for generating share codes.
 * Alphanumeric (A-Z, a-z, 0-9) for URL-safe codes.
 */
export const SHARE_CODE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Maximum shares allowed per user per hour.
 */
export const SHARE_RATE_LIMIT_PER_HOUR = 10;

/**
 * Share expiration time in days.
 */
export const SHARE_EXPIRATION_DAYS = 7;

/**
 * Maximum retry attempts for generating unique short codes.
 */
export const SHARE_CODE_MAX_RETRIES = 5;
