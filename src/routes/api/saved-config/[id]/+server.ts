import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { db, savedConfigurations } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { validateParameters } from '$lib/chaos-validation';
import type { ChaosMapType } from '$lib/types';

// TODO: Add integration tests for:
// - 401 response when not authenticated
// - 404 response when configId is missing or config not found
// - 403 response when config belongs to a different user
// - 200 response with correct configuration data on success
// - DELETE: 200 on success, 404 when not found, 403 when not owner (planned)
// These require mocking locals.safeGetSession() and the db module.
export const GET: RequestHandler = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		throw error(401, 'Unauthorized: Please log in to load saved configurations');
	}

	const configId = params.id;
	if (!configId) {
		throw error(400, 'Configuration ID is required');
	}

	const [config] = await db
		.select({
			id: savedConfigurations.id,
			userId: savedConfigurations.userId,
			mapType: savedConfigurations.mapType,
			parameters: savedConfigurations.parameters
		})
		.from(savedConfigurations)
		.where(eq(savedConfigurations.id, configId))
		.limit(1);

	if (!config) {
		throw error(404, 'Configuration not found');
	}

	if (config.userId !== user.id) {
		throw error(403, 'You do not have permission to access this configuration');
	}

	const mapType = config.mapType as ChaosMapType;
	const validation = validateParameters(mapType, config.parameters);
	if (!validation.isValid) {
		throw error(500, 'Saved configuration parameters are invalid');
	}

	return json({
		id: config.id,
		mapType,
		parameters: config.parameters
	});
};
