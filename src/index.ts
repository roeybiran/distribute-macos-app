#!/usr/bin/env node

import {
	cpSync, existsSync, mkdirSync, mkdtempSync, rmSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, join, resolve} from 'node:path';
import process from 'node:process';
import {Command} from 'commander';
import {execa} from 'execa';
import {archiveApp} from './steps/archive-app.js';
import {exportApp} from './steps/export-app.js';
import {dmg} from './steps/make-dmg.js';
import {sparkle} from './steps/sparkle.js';
import {red, green} from './util/colors.js';
import {getBuildSettings} from './util/get-build-settings.js';
import {preflightRelease} from './util/preflight.js';

const program = new Command();

const printCommandError = (error: unknown): never => {
	const errorMessage
			= error instanceof Error ? error.message : String(error);
	red(`Error: ${errorMessage}`);
	process.exit(1);
};

program
	.name('distribute-macos-app')
	.description('CLI tool for distributing macOS applications')
	.version('1.0.0');

program
	.command('release')
	.description('Release a macOS application')
	.requiredOption('--scheme <scheme>', 'Xcode scheme name')
	.requiredOption(
		'--keychain-profile <profile>',
		'Keychain profile for notarization',
	)
	.option(
		'--sparkle',
		'Generate Sparkle appcast and release notes',
	)
	.option(
		'--out-dir <path>',
		'Output directory for final release files',
	)
	.option(
		'--src-dir <path>',
		'Source directory, must contain an .xcodeproj file',
		process.cwd(),
	)
	.option(
		'--destination <destination-specifier>',
		'Destination device specifier',
		'generic/platform=macOS',
	)
	.option('--dmg-background <path>', 'Path to a custom DMG background image')
	.option('--full-release-notes-url <url>', 'URL for full release notes')
	.option('--app-homepage <url>', 'App homepage URL')
	.option('--reveal', 'Reveal the final DMG in Finder after build')
	.action(async ({
		srcDir,
		scheme,
		keychainProfile,
		destination,
		sparkle: sparkleEnabled,
		outDir,
		dmgBackground,
		fullReleaseNotesUrl,
		appHomepage,
		reveal,
	}: {
		srcDir: string;
		scheme: string;
		keychainProfile: string;
		destination: string;
		sparkle?: boolean;
		outDir?: string;
		dmgBackground?: string;
		fullReleaseNotesUrl?: string;
		appHomepage?: string;
		reveal?: boolean;
	}) => {
		try {
			const shouldGenerateSparkle = sparkleEnabled ?? false;
			const sparkleOutDir = shouldGenerateSparkle ? outDir : undefined;

			if (shouldGenerateSparkle && !sparkleOutDir) {
				throw new Error('--out-dir is required when --sparkle is provided.');
			}

			if (!shouldGenerateSparkle && (fullReleaseNotesUrl ?? appHomepage)) {
				throw new Error('--full-release-notes-url and --app-homepage can only be used with --sparkle.');
			}

			green('Gathering build settings...');
			const buildSettings = await getBuildSettings({
				srcDir,
				scheme,
				destinationSpecifier: destination,
			});
			const {
				PRODUCT_NAME: productName,
				MARKETING_VERSION: marketingVersion,
				CURRENT_PROJECT_VERSION: currentProjectVersion,
				CODE_SIGN_IDENTITY: codeSignIdentity,
				CODE_SIGN_STYLE: codeSignStyle,
				DEVELOPMENT_TEAM: developmentTeam,
			} = buildSettings;
			green(`Product name: ${productName}`);
			green(`Version: ${marketingVersion}`);
			green(`Build: ${currentProjectVersion}`);
			green(`Code sign identity: ${codeSignIdentity}`);
			green(`Code sign style: ${codeSignStyle}`);

			await preflightRelease({
				srcDir,
				keychainProfile,
				buildSettings,
				includeSparkle: Boolean(shouldGenerateSparkle),
			});

			const {xcArchivePath} = await archiveApp({
				srcDir,
				scheme,
				releasePlatform: destination,
				productName,
			});

			const {exportedAppPath} = await exportApp({
				srcDir,
				xcArchivePath,
				productName,
				developmentTeam,
				outputDir: shouldGenerateSparkle ? undefined : outDir,
			});

			const {dmgPath} = await dmg({
				exportedAppPath,
				productName,
				marketingVersion,
				keychainProfile,
				developmentTeam,
				dmgBackground,
			});

			if (sparkleOutDir) {
				await sparkle({
					srcDir,
					outDir: sparkleOutDir,
					buildSettings,
					dmgPath,
					fullReleaseNotesUrl,
					appHomepage,
				});
			}

			if (reveal) {
				await execa`open -R ${dmgPath}`;
			}

			green('Done!');
		} catch (error) {
			printCommandError(error);
		}
	});

program
	.command('preview-dmg')
	.description('Create a local unsigned DMG preview using the DUMMY.app fixture')
	.option('--out-dir <path>', 'Output directory for the preview DMG')
	.option('--dmg-background <path>', 'Path to a custom DMG background image')
	.option('--reveal', 'Reveal the preview DMG in Finder after build')
	.action(async ({
		outDir,
		dmgBackground,
		reveal,
	}: {
		outDir?: string;
		dmgBackground?: string;
		reveal?: boolean;
	}) => {
		try {
			const fixtureApp = join(process.cwd(), 'src/__tests__/fixtures/DUMMY.app');
			const resolvedFixtureAppPath = resolve(fixtureApp);
			if (!existsSync(resolvedFixtureAppPath)) {
				throw new Error(`Fixture app not found at ${resolvedFixtureAppPath}`);
			}

			const outputDir = outDir
				? resolve(outDir)
				: mkdtempSync(join(tmpdir(), 'distribute-dmg-preview-'));
			mkdirSync(outputDir, {recursive: true});

			const stagingDir = mkdtempSync(join(tmpdir(), 'distribute-dmg-preview-stage-'));
			const stagingAppPath = join(stagingDir, basename(resolvedFixtureAppPath));
			cpSync(resolvedFixtureAppPath, stagingAppPath, {recursive: true});

			try {
				const productName = basename(stagingAppPath, '.app');
				const {dmgPath: stagedDmgPath} = await dmg({
					exportedAppPath: stagingAppPath,
					productName,
					marketingVersion: 'preview',
					dmgBackground,
					skipCodeSigning: true,
					skipNotarization: true,
					skipSuccessLog: true,
				});

				const finalDmgPath = join(outputDir, basename(stagedDmgPath));
				rmSync(finalDmgPath, {force: true});
				cpSync(stagedDmgPath, finalDmgPath);

				green('DMG created:');
				green(finalDmgPath);

				if (reveal) {
					await execa`open -R ${finalDmgPath}`;
				}

				green('Done!');
			} finally {
				rmSync(stagingDir, {recursive: true, force: true});
			}
		} catch (error) {
			printCommandError(error);
		}
	});

program.parse();
