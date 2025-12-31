import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		},
		rules: {
			'no-undef': 'off',
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		files: ['src/lib/components/ui/ParameterSlider.svelte'],
		rules: {
			// This component intentionally keeps separate state for immediate UI feedback
			// (e.g., `internalValue`) and debounced prop updates (`value`). The
			// `svelte/prefer-writable-derived` rule does not account for this pattern,
			// so it is disabled here by design.
			'svelte/prefer-writable-derived': 'off'
		}
	},
	{
		ignores: ['build/', '.svelte-kit/', 'dist/', 'drizzle/', '.netlify/']
	}
];
