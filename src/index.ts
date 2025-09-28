#!/usr/bin/env node

import { Command } from "commander";
import { join } from "path";
import { build } from "./steps/build.ts";
import { dmg } from "./steps/dmg.ts";
import { sparkle } from "./steps/sparkle.ts";
import { checkSparklePrivateKey } from "./util/checkSparklePrivateKey.ts";
import { checkNotaryCredentials } from "./util/checkNotaryCredentials.ts";
import { checkDmgDependencies } from "./util/checkDmgDependencies.ts";
import { execa } from "execa";
import { getSigningIdentity } from "./util/getSigningIdentity.ts";
import { red, blue, green } from "./util/colors.ts";
import { DERIVED_DATA_PATH } from "./constants.ts";

const program = new Command();

program
  .name("distribute-macos-app")
  .description("CLI tool for distributing macOS applications")
  .version("1.0.0");

program
  .command("release")
  .description("Distribute a macOS application")
  .requiredOption("--scheme <scheme>", "Xcode scheme name")
  .requiredOption(
    "--keychain-profile <profile>",
    "Keychain profile for notarization"
  )
  .requiredOption("--team-id <teamId>", "Apple Developer Team ID")
  .option(
    "--src-dir <path>",
    "Source directory, must contain an .xcodeproj file",
    process.cwd()
  )
  .option(
    "--destination <destination-specifier>",
    "Destination device specifier",
    "generic/platform=macOS"
  )
  .action(
    async ({
      srcDir,
      scheme,
      keychainProfile,
      teamId,
      destination,
    }: {
      srcDir: string;
      scheme: string;
      keychainProfile: string;
      teamId: string;
      destination: string;
    }) => {
      try {
        // Run dependency checks at the beginning
        const { stdout: gitStatus } = await execa("git", ["status", "-s"], {
          cwd: srcDir,
        });
        if (gitStatus.trim()) {
          throw new Error(
            "Git working directory is dirty. Please commit or stash changes before building."
          );
        }

        const { stdout: currentBranch } = await execa(
          "git",
          ["rev-parse", "--abbrev-ref", "HEAD"],
          { cwd: srcDir }
        );
        if (
          currentBranch.trim() !== "main" &&
          currentBranch.trim() !== "master"
        ) {
          throw new Error(
            `Not on default branch (current: ${currentBranch.trim()}). Please switch to main or master branch.`
          );
        }

        blue("==> Checking create-dmg dependencies...");
        await checkDmgDependencies();

        blue("==> Checking Notary credentials...");
        await checkNotaryCredentials(keychainProfile);

        blue("==> Checking code signing identity...");
        await getSigningIdentity(teamId);

        green("✓ Prerequisites OK");

        const { exportedAppPath, productName, version } =
          await build(srcDir, scheme, destination, teamId);

        const { dmgPath } = await dmg({
          exportedAppPath,
          productName,
          version,
          keychainProfile,
          teamId,
        });

        green("✓ DMG created:");
        green(dmgPath);

      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        red(`Error: ${errorMessage}`);
        process.exit(1);
      }
    }
  );

program
  .command("sparkle")
  .description("Generate Sparkle files")
  .requiredOption("--dmg-path <path>", "Path to the DMG file")
  .requiredOption("--out-dir <path>", "Directory for Sparkle files")
  .option("--src-dir <path>", "Source .xcodeproj file path", process.cwd())
  .option("--full-release-notes-url <url>", "URL for full release notes")
  .option("--app-homepage <url>", "App homepage URL")
  .action(
    async ({
      dmgPath,
      srcDir,
      outDir,
      fullReleaseNotesUrl,
      appHomepage,
    }: {
      dmgPath: string;
      srcDir: string;
      outDir: string;
      fullReleaseNotesUrl?: string;
      appHomepage?: string;
    }) => {
      try {
        blue("==> Checking Sparkle private key...");
        await checkSparklePrivateKey();
        green("✓ Prerequisites OK");

        const derivedDataPath = join(srcDir, DERIVED_DATA_PATH);
        await sparkle({
          dmgPath,
          srcDir,
          outDir,
          ...(fullReleaseNotesUrl ? { fullReleaseNotesUrl } : {}),
          ...(appHomepage ? { appHomepage } : {}),
          derivedDataPath,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        red(`Error: ${errorMessage}`);
        process.exit(1);
      }
    }
  );

program.parse();
