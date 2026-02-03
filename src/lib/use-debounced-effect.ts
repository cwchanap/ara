/**
 * Creates a debounced effect that properly handles cleanup.
 *
 * @param fn - Function to execute after debounce delay
 * @param delay - Debounce delay in milliseconds (default: 300)
 * @returns Object with trigger and cleanup functions
 *
 * @example
 * const urlUpdater = useDebouncedEffect(() => {
 *   goto(`/path?${params}`, { replaceState: true });
 * }, DEBOUNCE_MS);
 *
 * $effect(() => {
 *   void param1; void param2;
 *   urlUpdater.trigger();
 *   return () => urlUpdater.cleanup();
 * });
 */
export function useDebouncedEffect(
	fn: () => void,
	delay: number = 300
): { trigger: () => void; cleanup: () => void } {
	let timer: ReturnType<typeof setTimeout> | null = null;

	const trigger = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			fn();
		}, delay);
	};

	const cleanup = () => {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	};

	return { trigger, cleanup };
}
