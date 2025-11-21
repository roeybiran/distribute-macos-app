#!/usr/bin/env node

import process from 'node:process';
import {Command} from 'commander';
import {buildApp} from './steps/build-app.js';
import {dmg} from './steps/dmg.js';
import {sparkle} from './steps/sparkle.js';
import {red} from './util/colors.js';
import {checkNotaryCredentials} from './util/check-notary-credentials.js';

const program = new Command();

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
	.requiredOption('--team-id <teamId>', 'Apple Developer Team ID')
	.requiredOption(
		'--out-dir <path>',
		'Output directory containing all releases',
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
	.option('--full-release-notes-url <url>', 'URL for full release notes')
	.option('--app-homepage <url>', 'App homepage URL')
	.action(async ({
		srcDir,
		scheme,
		keychainProfile,
		teamId,
		destination,
		outDir,
		fullReleaseNotesUrl,
		appHomepage,
	}: {
		srcDir: string;
		scheme: string;
		keychainProfile: string;
		teamId: string;
		destination: string;
		outDir: string;
		fullReleaseNotesUrl?: string;
		appHomepage?: string;
	}) => {
		// Preliminary check
		checkNotaryCredentials(keychainProfile);

		try {
			const {exportedAppPath, productName, version} = buildApp(
				srcDir,
				scheme,
				destination,
				teamId,
			);
			const {dmgPath} = dmg({
				exportedAppPath,
				productName,
				version,
				keychainProfile,
				teamId,
			});

			sparkle({
				srcDir,
				outDir,
				dmgPath,
				fullReleaseNotesUrl,
				appHomepage,
			});
		} catch (error) {
			red(`${error instanceof Error ? error.message : String(error)}`);
			process.exit(1);
		}
	});

program
	.command('sparkle')
	.description('Generate Sparkle files')
	.requiredOption(
		'--out-dir <path>',
		'Output directory containing all releases',
	)
	.option('--dmg-path <path>', 'Path to the new DMG file')
	.option('--src-dir <path>', 'Xcode project path', process.cwd())
	.option('--full-release-notes-url <url>', 'URL for full release notes')
	.option('--app-homepage <url>', 'App homepage URL')
	.action(async ({
		outDir,
		dmgPath,
		srcDir,
		fullReleaseNotesUrl,
		appHomepage,
	}: {
		outDir: string;
		dmgPath: string;
		srcDir: string;
		fullReleaseNotesUrl?: string;
		appHomepage?: string;
	}) => {
		try {
			sparkle({
				dmgPath,
				srcDir,
				outDir,
				fullReleaseNotesUrl,
				appHomepage,
			});
		} catch (error) {
			const errorMessage
          = error instanceof Error ? error.message : String(error);
			red(`Error: ${errorMessage}`);
			process.exit(1);
		}
	});

program.parse();
