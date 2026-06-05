// vitest.setup.node.ts
// Setup for the node project. Server modules read DATABASE_URL / NETLIFY_DATABASE_URL
// at import time; provide a dummy value so importing them in tests does not crash.
if (!process.env.DATABASE_URL && !process.env.NETLIFY_DATABASE_URL) {
	process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres';
}
