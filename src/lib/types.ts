// Shared types used across client and server code

export interface Profile {
	id: string;
	username: string;
	// Timestamps are strings due to Drizzle mode: 'string' configuration
	createdAt: string;
	updatedAt: string;
}
