import { defineConfig } from 'drizzle-kit';

// Support both DATABASE_URL (local) and NETLIFY_DATABASE_URL (Netlify Neon extension)
const databaseUrl = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
if (!databaseUrl) {
	throw new Error(
		'DATABASE_URL environment variable is required for drizzle-kit ' +
			'(or NETLIFY_DATABASE_URL when running on Netlify)'
	);
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: databaseUrl
	}
});
