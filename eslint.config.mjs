import nextConfig from 'eslint-config-next';

export default [
	...nextConfig,
	{
		rules: {
			'react-hooks/set-state-in-effect': 'warn',
			'react-hooks/purity': 'warn',
			'react-hooks/preserve-manual-memoization': 'warn',
		},
	},
];
