#!/usr/bin/env node

import process from 'node:process';
import {globSync, readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {Command} from 'commander';
import plist from 'plist';
import {archiveApp} from './steps/archive-app.js';
import {exportApp} from './steps/export-app.js';
import {dmg} from './steps/make-dmg.js';
import {sparkle} from './steps/sparkle.js';
import {red, green} from './util/colors.js';
import {getBuildSettings} from './util/get-build-settings.js';
import {archivesPath, exportsPath} from './constants.js';

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
	.action(
		async ({
			srcDir,
			scheme,
			keychainProfile,
			destination,
			outDir,
			fullReleaseNotesUrl,
			appHomepage,
		}: {
			srcDir: string;
			scheme: string;
			keychainProfile: string;
			destination: string;
			outDir: string;
			fullReleaseNotesUrl?: string;
			appHomepage?: string;
		}) => {
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

			const archivesPathLocal = join(srcDir, archivesPath);
			let xcArchivePath: string | undefined;
			const infoPlistPattern = join(
				archivesPathLocal,
				'*.xcarchive/Info.plist',
			);

			try {
				for (const infoPlistPath of globSync(infoPlistPattern)) {
					try {
						const parsedPlist = plist.parse(
							readFileSync(infoPlistPath, 'utf8'),
						) as any;

						const bundleVersion = Number(
							parsedPlist.ApplicationProperties.CFBundleVersion,
						);
						const currentProjectVersionNumber = Number(currentProjectVersion);

						if (bundleVersion === currentProjectVersionNumber) {
							const archivePath = dirname(infoPlistPath);
							green(
								`Found existing archive with matching version (${currentProjectVersion}): ${archivePath}`,
							);
							xcArchivePath = archivePath;
							break;
						}
					} catch {
						continue;
					}
				}
			} catch {}

			xcArchivePath ??= (
				await archiveApp({
					srcDir,
					scheme,
					releasePlatform: destination,
					productName,
				})
			).xcArchivePath;

			let exportedAppPath: string | undefined;
			const exportedInfoPlistPattern = join(
				srcDir,
				exportsPath,
				'*/*.app/Contents/Info.plist',
			);

			try {
				for (const infoPlistPath of globSync(exportedInfoPlistPattern)) {
					try {
						const parsedPlist = plist.parse(
							readFileSync(infoPlistPath, 'utf8'),
						) as any;

						const bundleVersion = Number(parsedPlist.CFBundleVersion);
						const currentProjectVersionNumber = Number(currentProjectVersion);

						if (bundleVersion === currentProjectVersionNumber) {
							// Extract app path from Info.plist path (go up two levels: Contents -> .app)
							const appPath = dirname(dirname(infoPlistPath));
							green(
								`Found existing exported app with matching version (${currentProjectVersion}): ${appPath}`,
							);
							exportedAppPath = appPath;
							break;
						}
					} catch {
						continue;
					}
				}
			} catch {}

			exportedAppPath ??= (
				await exportApp({
					srcDir,
					xcArchivePath,
					productName,
					developmentTeam,
				})
			).exportedAppPath;

			const {dmgPath} = await dmg({
				exportedAppPath,
				productName,
				marketingVersion,
				keychainProfile,
				developmentTeam,
			});

			await sparkle({
				srcDir,
				outDir,
				scheme,
				dmgPath,
				fullReleaseNotesUrl,
				appHomepage,
			});

			green('Done!');
		},
	);

program
	.command('sparkle')
	.description('Generate Sparkle files')
	.requiredOption(
		'--out-dir <path>',
		'Output directory containing all releases',
	)
	.option('--dmg-path <path>', 'Path to the new DMG file')
	.option('--src-dir <path>', 'Xcode project path', process.cwd())
	.option('--scheme <scheme>', 'Xcode scheme name')
	.option('--full-release-notes-url <url>', 'URL for full release notes')
	.option('--app-homepage <url>', 'App homepage URL')
	.action(
		async ({
			srcDir,
			outDir,
			dmgPath,
			scheme,
			fullReleaseNotesUrl,
			appHomepage,
		}: {
			outDir: string;
			dmgPath: string;
			srcDir: string;
			scheme: string;
			fullReleaseNotesUrl?: string;
			appHomepage?: string;
		}) => {
			try {
				await sparkle({
					dmgPath,
					srcDir,
					outDir,
					scheme,
					fullReleaseNotesUrl,
					appHomepage,
				});
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				red(`Error: ${errorMessage}`);
				process.exit(1);
			}
		},
	);

program.parse();
