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

	it('writes each changelog version to same-basename HTML release notes and full-history JSON', async () => {
		vi.mocked(readFileSync).mockReturnValue(`# Changelog

## ??? - ???

- Draft note

## 1.0 - 2026-05-02

- Added feature

## 0.9

Date: 2026-04-01

- Previous feature
`);
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
			'/tmp/releases/DUMMY 1.0.html',
			'<ul>\n<li>Added feature</li>\n</ul>\n',
		);
		expect(vi.mocked(writeFileSync)).toHaveBeenCalledWith(
			'/tmp/releases/DUMMY 0.9.html',
			'<ul>\n<li>Previous feature</li>\n</ul>\n',
		);
		expect(vi.mocked(writeFileSync)).toHaveBeenCalledWith(
			'/tmp/releases/release-notes.json',
			`${JSON.stringify([
				{
					body: '- Added feature',
					date: '2026-05-02',
					version: '1.0',
				},
				{
					body: '- Previous feature',
					date: '2026-04-01',
					version: '0.9',
				},
			], null, 2)}\n`,
		);
		expect(vi.mocked(writeFileSync)).not.toHaveBeenCalledWith(
			'/tmp/releases/DUMMY ???.html',
			expect.any(String),
		);
		expect(vi.mocked(copyFileSync)).toHaveBeenCalledWith(
			'/tmp/releases/DUMMY 1.0.dmg',
			'/tmp/releases/DUMMY 1.0.dmg',
		);
		expect(vi.mocked(execa)).toHaveBeenCalled();
	});
});
