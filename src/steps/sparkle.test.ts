import {
	beforeEach, describe, expect, it, vi,
} from 'vitest';
import {type BuildSettings} from '../util/get-build-settings.js';

vi.mock('node:fs', () => ({
	copyFileSync: vi.fn(),
	mkdirSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
}));

vi.mock('execa', () => ({
	execa: vi.fn().mockResolvedValue({}),
}));

const {
	copyFileSync,
	readFileSync,
	writeFileSync,
} = await import('node:fs');
const {execa} = await import('execa');
const {sparkle} = await import('./sparkle.js');

describe('sparkle', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('copies CHANGELOG.md to same-basename markdown release notes', async () => {
		const changelogMarkdown = `# Changelog

## 1.0

- Added feature

## 0.9

- Previous feature
`;
		vi.mocked(readFileSync).mockReturnValue(changelogMarkdown);
		const buildSettings = Object.fromEntries([
			['BUILD_DIR', '/tmp/project/.build/Build/Products'],
			['CODE_SIGN_IDENTITY', ''],
			['CODE_SIGN_STYLE', ''],
			['CURRENT_PROJECT_VERSION', '1'],
			['DEVELOPMENT_TEAM', ''],
			['MARKETING_VERSION', '1.0'],
			['PRODUCT_NAME', 'DUMMY'],
		]) as BuildSettings;

		await sparkle({
			srcDir: '/tmp/project',
			outDir: '/tmp/releases',
			dmgPath: '/tmp/releases/DUMMY 1.0.dmg',
			buildSettings,
		});

		expect(vi.mocked(writeFileSync)).toHaveBeenCalledWith(
			'/tmp/releases/DUMMY 1.0.md',
			changelogMarkdown,
		);
		expect(vi.mocked(copyFileSync)).toHaveBeenCalledWith(
			'/tmp/releases/DUMMY 1.0.dmg',
			'/tmp/releases/DUMMY 1.0.dmg',
		);
		expect(vi.mocked(execa)).toHaveBeenCalled();
	});
});
