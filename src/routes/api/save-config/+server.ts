import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, savedConfigurations } from '$lib/server/db';
import { VALID_MAP_TYPES } from '$lib/types';
import type { ChaosMapType, ChaosMapParameters } from '$lib/types';
import { validateParameters } from '$lib/chaos-validation';

/**
 * POST /api/save-config
 *
 * Save a new chaos map configuration.
 * Used by chaos map pages for cross-page save operations.
 *
 * TODO: Add integration tests for:
 * - 401 response when not authenticated (locals.safeGetSession returns no session)
 * - 400 response for invalid/missing JSON body
 * - 400 response for missing name, invalid mapType, or invalid parameters
 * - 201 response and returned configuration shape on success
 * - 500 response when database insert fails
 * These require mocking locals.safeGetSession() and the db module.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		throw error(401, 'Unauthorized: Please log in to save configurations');
	}

	// Parse request body
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON in request body');
	}

	// Validate request structure
	if (!body || typeof body !== 'object') {
		throw error(400, 'Request body must be an object');
	}

	const { name, mapType, parameters } = body as {
		name?: unknown;
		mapType?: unknown;
		parameters?: unknown;
	};

	// Validate name
	if (typeof name !== 'string') {
		throw error(400, 'Name is required and must be a string');
	}
	const trimmedName = name.trim();
	if (!trimmedName) {
		throw error(400, 'Name cannot be empty');
	}
	if (trimmedName.length > 100) {
		throw error(400, 'Name must be 100 characters or less');
	}

	// Validate mapType
	if (typeof mapType !== 'string') {
		throw error(400, 'Map type is required and must be a string');
	}
	if (!VALID_MAP_TYPES.includes(mapType as ChaosMapType)) {
		throw error(400, `Invalid map type. Must be one of: ${VALID_MAP_TYPES.join(', ')}`);
	}

	// Validate parameters structure and types
	const validation = validateParameters(mapType as ChaosMapType, parameters);
	if (!validation.isValid) {
		throw error(400, `Invalid parameters: ${validation.errors.join(', ')}`);
	}

	try {
		// Insert new configuration
		const [newConfig] = await db
			.insert(savedConfigurations)
			.values({
				userId: user.id,
				name: trimmedName,
				mapType: mapType as ChaosMapType,
				parameters: parameters as ChaosMapParameters
			})
			.returning({
				id: savedConfigurations.id,
				name: savedConfigurations.name,
				mapType: savedConfigurations.mapType,
				createdAt: savedConfigurations.createdAt
			});

		return json(
			{
				success: true,
				configuration: newConfig
			},
			{ status: 201 }
		);
	} catch (err) {
		console.error('Failed to save configuration:', err);
		throw error(500, 'Failed to save configuration. Please try again.');
	}
};
