import { mkdirSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import plist from "plist";
import { execa } from "execa";
import prompts from "prompts";
import { XCODE_PATHS, APP_PATHS } from "../constants.ts";
import { getSigningIdentity } from "../util/getSigningIdentity.ts";

export const build = async (srcDir: string, schemeName: string, destinationSpecifier: string) => {
  // Check if directory contains .xcodeproj
  const files = readdirSync(srcDir);
  if (!files.some((file) => file.endsWith(".xcodeproj"))) {
    throw new Error("Source directory must contain an .xcodeproj file");
  }

  // Set up derived data path in project directory
  const derivedDataPath = join(srcDir, ".build");

  // Get build settings
  console.log(chalk.green("==> Gathering build settings..."));
  const { stdout } = await execa(
    "xcodebuild",
    [
      "-showBuildSettings",
      "-scheme",
      schemeName,
      "-derivedDataPath",
      derivedDataPath,
      "-configuration",
      "Release",
      "-destination",
      destinationSpecifier,
      "-json",
      "-quiet",
    ],
    { cwd: srcDir }
  );

  let json: any;
  try {
    json = JSON.parse(stdout);
  } catch (error) {
    console.log(stdout);
    throw error;
  }

  const [{
    buildSettings: {
      PRODUCT_NAME: productName,
      DEVELOPMENT_TEAM: teamId,
      MARKETING_VERSION: version,
      CURRENT_PROJECT_VERSION: buildVersion,
    },
  }] = json;

  const missingSettings: string[] = [];
  if (!productName) missingSettings.push("PRODUCT_NAME");
  if (!teamId) missingSettings.push("DEVELOPMENT_TEAM");
  if (!version) missingSettings.push("MARKETING_VERSION");
  if (!buildVersion) missingSettings.push("CURRENT_PROJECT_VERSION");

  if (missingSettings.length > 0) {
    throw new Error(
      `Missing required build settings: ${missingSettings.join(", ")}`
    );
  }

  // Check signing identity before building
  console.log(chalk.blue("==> Checking code signing identity..."));
  await getSigningIdentity(teamId);

  // Set up paths
  const date = new Date();
  const [datePart, timePart] = date.toISOString().split("T");

  const archiveFolder = join(XCODE_PATHS.ARCHIVES, datePart);

  const [year, month, day] = datePart.split("-");
  const reversedDate = `${day}-${month}-${year}`;
  const time = timePart.split(":").slice(0, 2).join(".");
  const xcArchiveName = `${productName} ${reversedDate}, ${time}`;
  const xcArchivePath = join(archiveFolder, `${xcArchiveName}.xcarchive`);

  const exportPath = join(APP_PATHS.CACHE, xcArchiveName);
  const plistPath = join(exportPath, "ExportOptions.plist");
  const exportedAppPath = join(exportPath, `${productName}.app`);

  // Check Git status
  const { stdout: gitStatus } = await execa("git", ["status", "-s"], {
    cwd: srcDir,
  });
  const { stdout: currentBranch } = await execa(
    "git",
    ["rev-parse", "--abbrev-ref", "HEAD"],
    { cwd: srcDir }
  );

  // Log build information
  console.log(chalk.green(`==> Team ID: ${teamId}`));
  console.log(chalk.green(`==> Scheme: ${schemeName}`));
  console.log(chalk.green(`==> Product name: ${productName}`));
  console.log(chalk.green(`==> Version: ${version}`));
  console.log(chalk.green(`==> Build: ${buildVersion}`));
  console.log(chalk.green(`==> Archive path: ${xcArchivePath}`));
  console.log(chalk.green(`==> Export path: ${exportPath}`));
  console.log(chalk.green(`==> Git branch: ${currentBranch.trim()}`));
  console.log(
    chalk.green(
      `==> Git status: ${gitStatus ? chalk.red("DIRTY") : chalk.green("CLEAN")}`
    )
  );

  const { value } = await prompts({
    type: "toggle",
    name: "value",
    message: "Is this OK?",
    initial: true,
    active: "Yes",
    inactive: "No",
  });

  if (!value) {
    throw new Error("Build cancelled by user");
  }

  // Create necessary directories
  mkdirSync(archiveFolder, { recursive: true });
  mkdirSync(exportPath, { recursive: true });

  console.log(chalk.green("==> Cleaning..."));
  await execa(
    "xcodebuild",
    ["clean", "-scheme", schemeName, "-derivedDataPath", derivedDataPath],
    { cwd: srcDir }
  );

  console.log(chalk.green("==> Archiving..."));
  await execa(
    "xcodebuild",
    [
      "archive",
      "-configuration",
      "Release",
      "-destination",
      destinationSpecifier,
      "-scheme",
      schemeName,
      "-archivePath",
      xcArchivePath,
      "-derivedDataPath",
      derivedDataPath,
    ],
    { stdio: "inherit", cwd: srcDir }
  );

  console.log(chalk.green("==> Exporting..."));
  const exportOptionsPlist = {
    destination: "export",
    method: "developer-id",
    signingStyle: "automatic",
    team: teamId,
  };
  writeFileSync(plistPath, plist.build(exportOptionsPlist));
  await execa(
    "xcodebuild",
    [
      "-exportArchive",
      "-archivePath",
      xcArchivePath,
      "-exportPath",
      exportPath,
      "-exportOptionsPlist",
      plistPath,
    ],
    { stdio: "inherit", cwd: srcDir }
  );

  return {
    exportedAppPath,
    productName,
    version,
    teamId,
    derivedDataPath,
  };
};
