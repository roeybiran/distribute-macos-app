import { mkdirSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import plist from "plist";
import { execa } from "execa";

export const build = async (srcDir: string, schemeName: string, destinationSpecifier: string, teamId: string) => {
  const files = readdirSync(srcDir);
  if (!files.some((file) => file.endsWith(".xcodeproj"))) {
    throw new Error("Source directory must contain an .xcodeproj file");
  }

  console.log(chalk.green("==> Gathering build settings..."));
  const { stdout } = await execa(
    "xcodebuild",
    [
      "-showBuildSettings",
      "-scheme",
      schemeName,
      "-configuration",
      "Release",
      "-json"
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
      MARKETING_VERSION: version,
      CURRENT_PROJECT_VERSION: buildVersion,
    },
  }] = json;

  const derivedDataPath = join(srcDir, ".build/DerivedData");
  const date = new Date();
  const timestamp = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
  const archiveFolder = join(srcDir, ".build/Archives");
  const xcArchiveName = `${productName} ${timestamp}`;
  const xcArchivePath = join(archiveFolder, `${xcArchiveName}.xcarchive`);

  const exportPath = join(srcDir, ".build/Exports", xcArchiveName);
  const plistPath = join(exportPath, "ExportOptions.plist");
  const exportedAppPath = join(exportPath, `${productName}.app`);

  console.log(chalk.green(`==> Team ID: ${teamId}`));
  console.log(chalk.green(`==> Scheme: ${schemeName}`));
  console.log(chalk.green(`==> Product name: ${productName}`));
  console.log(chalk.green(`==> Version: ${version}`));
  console.log(chalk.green(`==> Build: ${buildVersion}`));
  console.log(chalk.green(`==> Archive path: ${xcArchivePath}`));
  console.log(chalk.green(`==> Export path: ${exportPath}`));

  mkdirSync(archiveFolder, { recursive: true });
  mkdirSync(exportPath, { recursive: true });

  console.log(chalk.green("==> Cleaning..."));
  await execa(
    "xcodebuild",
    [
      "clean", 
      "-scheme", 
      schemeName, 
      "-derivedDataPath", 
      derivedDataPath,
      `DEVELOPMENT_TEAM=${teamId}`,
      `CODE_SIGNING_STYLE=Automatic`,
    ],
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
      `DEVELOPMENT_TEAM=${teamId}`,
      "CODE_SIGNING_STYLE=Automatic",
    ],
    { stdio: "inherit", cwd: srcDir }
  );

  console.log(chalk.green("==> Exporting..."));

  const exportOptionsPlist = {
    destination: "export",
    method: "developer-id",
    signingStyle: "manual",
    signingCertificate: "Developer ID Application",
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
