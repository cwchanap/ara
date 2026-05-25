import { createAuthClient } from '@neondatabase/auth';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

type NeonAuthResult = {
	data?: unknown;
	error?: unknown;
};

export type NeonAuthClient = {
	signIn: {
		social: (options: { provider: 'google'; callbackURL: string }) => Promise<NeonAuthResult>;
	};
	signOut: () => Promise<NeonAuthResult>;
	getSession: () => Promise<NeonAuthResult>;
};

export type CreateNeonAuthClientOptions = {
	headers?: HeadersInit;
};

const SAFE_AUTH_HEADER_NAMES = ['cookie', 'authorization', 'origin'] as const;

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> | undefined {
	if (!headers) return undefined;

	const inputHeaders = new Headers(headers);
	const safeHeaders: Record<string, string> = {};

	for (const headerName of SAFE_AUTH_HEADER_NAMES) {
		const value = inputHeaders.get(headerName);
		if (value) {
			safeHeaders[headerName] = value;
		}
	}

	return Object.keys(safeHeaders).length > 0 ? safeHeaders : undefined;
}

export function getNeonAuthUrl(): string {
	const url =
		privateEnv.NEON_AUTH_BASE_URL ||
		privateEnv.VITE_NEON_AUTH_URL ||
		publicEnv.PUBLIC_NEON_AUTH_URL;

	if (!url) {
		throw new Error(
			'NEON_AUTH_BASE_URL, VITE_NEON_AUTH_URL, or PUBLIC_NEON_AUTH_URL is required'
		);
	}

	return url;
}

export function createNeonAuthClient(options: CreateNeonAuthClientOptions = {}): NeonAuthClient {
	const config = {
		fetchOptions: {
			headers: normalizeHeaders(options.headers)
		}
	} as unknown as Parameters<typeof createAuthClient>[1];

	return createAuthClient(getNeonAuthUrl(), config) as unknown as NeonAuthClient;
}
