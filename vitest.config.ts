import type {UserConfig} from 'vitest/config';

const config: UserConfig = {
	test: {
		environment: 'node',
		testTimeout: 120_000, // Xcodebuild is slow
		hookTimeout: 180_000, // BeforeAll archiving can take time
	},
};

export default config;
