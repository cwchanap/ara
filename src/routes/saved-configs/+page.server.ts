import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { base } from '$app/paths';
import { db, savedConfigurations } from '$lib/server/db';
import { eq, desc } from 'drizzle-orm';
import { VALID_MAP_TYPES } from '$lib/types';
import type { ChaosMapType, ChaosMapParameters, SavedConfiguration } from '$lib/types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();

	// Redirect unauthenticated users to login
	if (!session || !user) {
		throw redirect(303, `${base}/login?redirect=${encodeURIComponent(url.pathname)}`);
	}

	// Fetch all saved configurations for this user, sorted by most recent
	const configurations = await db
		.select()
		.from(savedConfigurations)
		.where(eq(savedConfigurations.userId, user.id))
		.orderBy(desc(savedConfigurations.createdAt));

	// Type-cast the results to include proper types
	const typedConfigurations: SavedConfiguration[] = configurations.map((config) => ({
		...config,
		mapType: config.mapType as ChaosMapType,
		parameters: config.parameters as ChaosMapParameters
	}));

	return {
		configurations: typedConfigurations
	};
};

export const actions: Actions = {
	/**
	 * Save a new configuration
	 */
	save: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();

		if (!session || !user) {
			return fail(401, { saveError: 'Please log in to save configurations' });
		}

		const formData = await request.formData();
		const name = formData.get('name');
		const mapType = formData.get('mapType');
		const parametersJson = formData.get('parameters');

		// Validate name
		if (typeof name !== 'string' || !name.trim()) {
			return fail(400, { saveError: 'Configuration name is required', mapType, name });
		}
		const trimmedName = name.trim();
		if (trimmedName.length > 100) {
			return fail(400, { saveError: 'Name must be 100 characters or less', mapType, name });
		}

		// Validate mapType
		if (typeof mapType !== 'string' || !VALID_MAP_TYPES.includes(mapType as ChaosMapType)) {
			return fail(400, { saveError: 'Invalid map type', mapType, name: trimmedName });
		}

		// Validate and parse parameters
		if (typeof parametersJson !== 'string') {
			return fail(400, { saveError: 'Parameters are required', mapType, name: trimmedName });
		}

		let parameters: ChaosMapParameters;
		try {
			parameters = JSON.parse(parametersJson);
		} catch {
			return fail(400, {
				saveError: 'Invalid parameters format',
				mapType,
				name: trimmedName
			});
		}

		try {
			const [newConfig] = await db
				.insert(savedConfigurations)
				.values({
					userId: user.id,
					name: trimmedName,
					mapType: mapType as ChaosMapType,
					parameters
				})
				.returning({ id: savedConfigurations.id });

			return { success: true, configurationId: newConfig.id };
		} catch (err) {
			console.error('Failed to save configuration:', err);
			return fail(500, {
				saveError: 'Failed to save configuration',
				mapType,
				name: trimmedName
			});
		}
	},

	/**
	 * Delete a configuration
	 */
	delete: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();

		if (!session || !user) {
			return fail(401, { deleteError: 'Please log in to delete configurations' });
		}

		const formData = await request.formData();
		const configurationId = formData.get('configurationId');

		if (typeof configurationId !== 'string' || !configurationId) {
			return fail(400, { deleteError: 'Configuration ID is required' });
		}

		try {
			// Check if config exists and belongs to user
			const [existing] = await db
				.select({ id: savedConfigurations.id, userId: savedConfigurations.userId })
				.from(savedConfigurations)
				.where(eq(savedConfigurations.id, configurationId))
				.limit(1);

			if (!existing) {
				return fail(404, { deleteError: 'Configuration not found' });
			}

			if (existing.userId !== user.id) {
				return fail(403, {
					deleteError: 'You do not have permission to delete this configuration'
				});
			}

			// Delete the configuration
			await db.delete(savedConfigurations).where(eq(savedConfigurations.id, configurationId));

			return { deleteSuccess: true };
		} catch (err) {
			console.error('Failed to delete configuration:', err);
			return fail(500, { deleteError: 'Failed to delete configuration' });
		}
	},

	/**
	 * Rename a configuration
	 */
	rename: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();

		if (!session || !user) {
			return fail(401, { renameError: 'Please log in to rename configurations' });
		}

		const formData = await request.formData();
		const configurationId = formData.get('configurationId');
		const name = formData.get('name');

		if (typeof configurationId !== 'string' || !configurationId) {
			return fail(400, { renameError: 'Configuration ID is required' });
		}

		// Validate name
		if (typeof name !== 'string' || !name.trim()) {
			return fail(400, { renameError: 'New name is required', configurationId });
		}
		const trimmedName = name.trim();
		if (trimmedName.length > 100) {
			return fail(400, {
				renameError: 'Name must be 100 characters or less',
				configurationId
			});
		}

		try {
			// Check if config exists and belongs to user
			const [existing] = await db
				.select({ id: savedConfigurations.id, userId: savedConfigurations.userId })
				.from(savedConfigurations)
				.where(eq(savedConfigurations.id, configurationId))
				.limit(1);

			if (!existing) {
				return fail(404, { renameError: 'Configuration not found', configurationId });
			}

			if (existing.userId !== user.id) {
				return fail(403, {
					renameError: 'You do not have permission to rename this configuration',
					configurationId
				});
			}

			// Update the configuration name (updated_at is handled automatically by ORM)
			await db
				.update(savedConfigurations)
				.set({
					name: trimmedName
				})
				.where(eq(savedConfigurations.id, configurationId));

			return { renameSuccess: true, name: trimmedName };
		} catch (err) {
			console.error('Failed to rename configuration:', err);
			return fail(500, { renameError: 'Failed to rename configuration', configurationId });
		}
	}
};
