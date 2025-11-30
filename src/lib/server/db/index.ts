import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { DATABASE_URL } from '$env/static/private';

// Create Neon SQL client
const sql = neon(DATABASE_URL);

// Create Drizzle database instance with schema
export const db = drizzle(sql, { schema });

// Re-export schema tables for convenience
export { profiles } from './schema';

// Re-export types from shared types module
export type { Profile } from '$lib/types';
