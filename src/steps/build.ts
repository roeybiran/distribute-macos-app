import { mkdirSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import plist from "plist";
import { execa } from "execa";
import { green } from "../util/colors.ts";
import { DERIVED_DATA_PATH } from "../constants.ts";

export const build = async (
  srcDir: string,
  schemeName: string,
  destinationSpecifier: string,
  teamId: string
) => {
  
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
  if (currentBranch.trim() !== "main" && currentBranch.trim() !== "master") {
    throw new Error(
      `Not on default branch (current: ${currentBranch.trim()}). Please switch to main or master branch.`
    );
  }

  const files = readdirSync(srcDir);
  if (!files.some((file) => file.endsWith(".xcodeproj"))) {
    throw new Error("Source directory must contain an .xcodeproj file");
  }

  green("Gathering build settings...");
  const { stdout } = await execa(
    "xcodebuild",
    [
      "-showBuildSettings",
      "-scheme",
      schemeName,
      "-configuration",
      "Release",
      "-json",
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

  const [
    {
      buildSettings: {
        PRODUCT_NAME: productName,
        MARKETING_VERSION: version,
        CURRENT_PROJECT_VERSION: buildVersion,
      },
    },
  ] = json;

  const derivedDataPath = join(srcDir, DERIVED_DATA_PATH);
  const archivesPath = join(srcDir, ".build/Archives");
  const exportsPath = join(srcDir, ".build/Exports");

  const date = new Date();
  const timestamp = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
  const xcArchiveName = `${productName} ${timestamp}`;
  const xcArchivePath = join(archivesPath, `${xcArchiveName}.xcarchive`);

  const exportedArchivePath = join(exportsPath, xcArchiveName);
  const plistPath = join(exportedArchivePath, "ExportOptions.plist");
  const exportedAppPath = join(exportedArchivePath, `${productName}.app`);

  green(`Team ID: ${teamId}`);
  green(`Scheme: ${schemeName}`);
  green(`Product name: ${productName}`);
  green(`Version: ${version}`);
  green(`Build: ${buildVersion}`);
  green(`Archive path: ${xcArchivePath}`);
  green(`Export path: ${exportedArchivePath}`);

  mkdirSync(archivesPath, { recursive: true });
  mkdirSync(exportedArchivePath, { recursive: true });

  const sharedSettings = [
    "-scheme",
    schemeName,
    "-derivedDataPath",
    derivedDataPath,
    `DEVELOPMENT_TEAM=${teamId}`,
    "CODE_SIGNING_STYLE=Manual",
    "CODE_SIGN_IDENTITY=Developer ID Application",
  ];

  green("Cleaning...");
  await execa("xcodebuild", ["clean", ...sharedSettings], { cwd: srcDir });

  green("Archiving...");
  await execa(
    "xcodebuild",
    [
      "archive",
      "-configuration",
      "Release",
      "-destination",
      destinationSpecifier,
      "-archivePath",
      xcArchivePath,
      ...sharedSettings,
    ],
    { stdio: "inherit", cwd: srcDir }
  );

  green("Exporting...");

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
      exportedArchivePath,
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
  };
};
