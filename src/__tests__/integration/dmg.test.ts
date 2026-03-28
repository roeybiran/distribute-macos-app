/**
 * Integration test for the DMG step in isolation.
 * Uses a real fixture .app bundle. appdmg runs for real (unsigned DMG).
 * checkNotaryCredentials, getSigningIdentity, and xcrun stapler/notarytool are mocked.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {Buffer} from 'node:buffer';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import type {ExecaMethod} from 'execa';
import {
	describe, it, expect, vi, beforeAll, afterAll,
} from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures');

// Mock execa: intercept xcrun notarytool/stapler calls
vi.mock('execa', async importOriginal => {
	const mod = await importOriginal();
	const actualModule = mod as Record<string, unknown> & {execa: ExecaMethod};
	const {execa: realExeca} = actualModule;

	const mockExeca = ((...args: unknown[]): ReturnType<ExecaMethod> => {
		const [first] = args as [unknown, ...unknown[]];
		if (Array.isArray(first)) {
			const cmdString = first.join('');
			if (
				cmdString.includes('notarytool')
				|| cmdString.includes('stapler')
			) {
				return Promise.resolve({
					stdout: '',
					stderr: '',
					exitCode: 0,
					failed: false,
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

// Mock getSigningIdentity so appdmg creates an unsigned DMG (no Developer ID cert needed)
vi.mock('../../util/get-signing-identity.js', () => ({
	getSigningIdentity: vi.fn().mockResolvedValue(null),
}));

const {dmg} = await import('../../steps/make-dmg.js');

let temporaryDir: string;
let appPath: string;
let resultDmgPath: string;

beforeAll(async () => {
	temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'distribute-dmg-test-'));

	// Copy the fixture .app bundle into the temp directory
	fs.cpSync(path.join(fixturesDir, 'DUMMY.app'), path.join(temporaryDir, 'DUMMY.app'), {
		recursive: true,
	});

	appPath = path.join(temporaryDir, 'DUMMY.app');
	const backgroundPath = path.join(temporaryDir, 'background.png');
	fs.writeFileSync(
		backgroundPath,
		Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3Z1XQAAAAASUVORK5CYII=', 'base64'),
	);
	execFileSync('/usr/bin/sips', ['-z', '480', '640', backgroundPath, '--out', backgroundPath], {stdio: 'pipe'});

	const result = await dmg({
		exportedAppPath: appPath,
		productName: 'DUMMY',
		marketingVersion: '1.0',
		keychainProfile: 'dummy-profile',
		developmentTeam: '',
		dmgBackground: backgroundPath,
	});

	resultDmgPath = result.dmgPath;
});

afterAll(() => {
	if (temporaryDir) {
		fs.rmSync(temporaryDir, {recursive: true, force: true});
	}
});

describe('dmg step (isolated)', () => {
	it('creates a DMG file with the correct name', () => {
		expect(path.basename(resultDmgPath)).toBe('DUMMY 1.0.dmg');
	});

	it('DMG file exists in the same directory as the .app', () => {
		expect(fs.existsSync(resultDmgPath)).toBe(true);
		expect(path.dirname(resultDmgPath)).toBe(temporaryDir);
	});

	it('DMG file is non-empty', () => {
		const stat = fs.statSync(resultDmgPath);
		expect(stat.size).toBeGreaterThan(0);
	});
});
