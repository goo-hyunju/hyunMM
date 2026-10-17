import tseslint from 'typescript-eslint';

export default tseslint.config(
	{ ignores: ['out/', 'dist/', 'node_modules/', 'service/', 'projects/'] },
	...tseslint.configs.recommended,
	{
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
		},
	}
);
