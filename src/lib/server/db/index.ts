import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

// Create Neon SQL client
// Support both DATABASE_URL (local) and NETLIFY_DATABASE_URL (Netlify Neon extension)
const databaseUrl = env.DATABASE_URL || env.NETLIFY_DATABASE_URL;
if (!databaseUrl) {
	throw new Error(
		'DATABASE_URL environment variable is required (or NETLIFY_DATABASE_URL when deployed to Netlify)'
	);
}
const sql = neon(databaseUrl);

// Create Drizzle database instance with schema
export const db = drizzle(sql, { schema });

// Re-export schema tables for convenience
export { profiles, savedConfigurations, sharedConfigurations } from './schema';

// Re-export types from shared types module
export type { Profile, SavedConfiguration, ChaosMapType, ChaosMapParameters } from '$lib/types';
