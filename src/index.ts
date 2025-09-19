#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import { join } from 'path';
import { build } from './steps/build.ts';
import { dmg } from './steps/dmg.ts';
import { sparkle } from './steps/sparkle.ts';
import { checkSparklePrivateKey } from './util/checkSparklePrivateKey.ts';
import { checkNotaryCredentials } from './util/checkNotaryCredentials.ts';
import { checkDmgDependencies } from './util/checkDmgDependencies.ts';

const program = new Command();

program
  .name('distribute-macos-app')
  .description('CLI tool for distributing macOS applications')
  .version('1.0.0');

program
  .command('release')
  .description('Distribute a macOS application')
  .requiredOption('--src-dir <path>', 'Source directory, must contain an .xcodeproj file')
  .requiredOption('--scheme <scheme>', 'Xcode scheme name')
  .requiredOption('--out-dir <path>', 'Output directory, will contain the DMG and Sparkle appcast.xml file')
  .requiredOption('--keychain-profile <profile>', 'Keychain profile for notarization')
  .option('--destination <destination-specifier>', 'Destination device specifier', 'generic/platform=macOS')
  .option('--full-release-notes-url <url>', 'URL for full release notes')
  .option('--app-homepage <url>', 'App homepage URL')
  .action(async ({ srcDir, scheme, keychainProfile, outDir, fullReleaseNotesUrl, appHomepage, destination }: {
    srcDir: string;
    scheme: string;
    keychainProfile: string;
    outDir: string;
    fullReleaseNotesUrl?: string;
    appHomepage?: string;
    destination: string;
  }) => {
    try {
      // Run dependency checks at the beginning
      console.log(chalk.blue('==> Checking dependencies...'));
      await checkDmgDependencies();
      await checkNotaryCredentials(keychainProfile);
      await checkSparklePrivateKey();
      console.log(chalk.green('✓ All Dependencies OK'));
      
      const { exportedAppPath, productName, version, teamId, derivedDataPath } = await build(srcDir, scheme, destination);
      const { dmgPath } = await dmg({ exportedAppPath, productName, version, keychainProfile, teamId });
      await sparkle({ dmgPath, srcDir, outDir, fullReleaseNotesUrl, appHomepage, derivedDataPath });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${errorMessage}`));
      process.exit(1);
    }
  });

program
  .command('sparkle')
  .description('Generate Sparkle files')
  .requiredOption('--dmg-path <path>', 'Path to the DMG file')
  .requiredOption('--src-dir <path>', 'Source .xcodeproj file path')
  .requiredOption('--out-dir <path>', 'Directory for Sparkle files')
  .option('--full-release-notes-url <url>', 'URL for full release notes')
  .option('--app-homepage <url>', 'App homepage URL')
  .action(async ({ dmgPath, srcDir, outDir, fullReleaseNotesUrl, appHomepage }: {
    dmgPath: string;
    srcDir: string;
    outDir: string;
    fullReleaseNotesUrl?: string;
    appHomepage?: string;
  }) => {
    try {
      // For standalone sparkle command, use the project's .build directory
      const derivedDataPath = join(srcDir, '.build');
      await sparkle({ dmgPath, srcDir, outDir, fullReleaseNotesUrl, appHomepage, derivedDataPath });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${errorMessage}`));
      process.exit(1);
    }
  });

program.parse(); 
