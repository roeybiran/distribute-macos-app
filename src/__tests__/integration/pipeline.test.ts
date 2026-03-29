/**
 * Integration test: full archive → export → DMG pipeline against the DUMMY fixture project.
 * - xcodebuild archive, test, and export run for real (ad-hoc signing, no Developer ID needed)
 * - export uses method:mac-application which works without a Developer ID cert
 * - notarytool / stapler xcrun calls are intercepted via a Proxy and short-circuited
 * - checkNotaryCredentials and getSigningIdentity are mocked
 */
import {execSync} from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {ExecaMethod} from 'execa';
import {
	describe, it, expect, vi, beforeAll, afterAll,
} from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures');

vi.mock('execa', async importOriginal => {
	const mod = await importOriginal();
	const actualModule = mod as Record<string, unknown> & {execa: ExecaMethod};
	const {execa: realExeca} = actualModule;

	const mockExeca = ((...args: unknown[]): ReturnType<ExecaMethod> => {
		const [first] = args as [unknown, ...unknown[]];
		if (Array.isArray(first)) {
			const cmdString = first.join('');
			if (cmdString.includes('notarytool') || cmdString.includes('stapler')) {
				return Promise.resolve({
					stdout: '', stderr: '', exitCode: 0, failed: false,
				}) as ReturnType<ExecaMethod>;
			}
		}

		return realExeca(...args as Parameters<ExecaMethod>);
	}) as unknown as ExecaMethod;

	return {...actualModule, execa: mockExeca};
});

vi.mock('../../util/check-notary-credentials.js', () => ({
	checkNotaryCredentials: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../util/get-signing-identity.js', () => ({
	getSigningIdentity: vi.fn().mockResolvedValue(null),
}));

const {archiveApp} = await import('../../steps/archive-app.js');
const {exportApp} = await import('../../steps/export-app.js');
const {dmg} = await import('../../steps/make-dmg.js');

let temporaryDir: string;
let xcArchivePath: string;
let exportedAppPath: string;
let exportedDsymPath: string;
let dmgPath: string;

beforeAll(async () => {
	temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'distribute-test-'));

	fs.cpSync(path.join(fixturesDir, 'DUMMY'), temporaryDir, {recursive: true});

	execSync('git init', {cwd: temporaryDir, stdio: 'pipe'});
	execSync('git checkout -b main', {cwd: temporaryDir, stdio: 'pipe'});
	execSync('git add .', {cwd: temporaryDir, stdio: 'pipe'});
	execSync(
		'git -c user.email="test@test.com" -c user.name="Test" commit -m "init"',
		{cwd: temporaryDir, stdio: 'pipe'},
	);

	const archiveResult = await archiveApp({
		srcDir: temporaryDir,
		scheme: 'DUMMY',
		releasePlatform: 'generic/platform=macOS',
		productName: 'DUMMY',
	});
	xcArchivePath = archiveResult.xcArchivePath;

	const exportResult = await exportApp({
		srcDir: temporaryDir,
		xcArchivePath,
		productName: 'DUMMY',
		developmentTeam: 'FOO',
		method: 'mac-application',
	});
	exportedAppPath = exportResult.exportedAppPath;
	exportedDsymPath = exportResult.exportedDsymPath;

	const dmgResult = await dmg({
		exportedAppPath,
		productName: 'DUMMY',
		marketingVersion: '1.0',
		keychainProfile: 'dummy-profile',
		developmentTeam: 'FOO',
	});
	dmgPath = dmgResult.dmgPath;
});

afterAll(() => {
	if (temporaryDir) {
		fs.rmSync(temporaryDir, {recursive: true, force: true});
	}
});

describe('pipeline integration', () => {
	it('archive creates an .xcarchive directory', () => {
		expect(fs.existsSync(xcArchivePath)).toBe(true);
		expect(xcArchivePath).toMatch(/\.xcarchive$/);
		expect(fs.statSync(xcArchivePath).isDirectory()).toBe(true);
	});

	it('xcarchive contains the app binary', () => {
		const appPath = path.join(xcArchivePath, 'Products/Applications/DUMMY.app');
		expect(fs.existsSync(appPath)).toBe(true);
	});

	it('export creates DUMMY.app directory', () => {
		expect(exportedAppPath).toMatch(/DUMMY\.app$/);
		expect(fs.existsSync(exportedAppPath)).toBe(true);
		expect(fs.statSync(exportedAppPath).isDirectory()).toBe(true);
	});

	it('export copies DUMMY.app.dSYM into the exported version directory', () => {
		expect(exportedDsymPath).toMatch(/DUMMY\.app\.dSYM$/);
		expect(fs.existsSync(exportedDsymPath)).toBe(true);
		expect(fs.statSync(exportedDsymPath).isDirectory()).toBe(true);
	});

	it('DMG file exists with correct name', () => {
		expect(path.basename(dmgPath)).toBe('DUMMY 1.0.dmg');
		expect(fs.existsSync(dmgPath)).toBe(true);
	});

	it('DMG file is non-empty', () => {
		expect(fs.statSync(dmgPath).size).toBeGreaterThan(0);
	});
});
