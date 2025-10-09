import { mkdirSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import plist from "plist";
import { execCommand } from "../util/execCommand.js";
import { green } from "../util/colors.js";
import { DERIVED_DATA_PATH } from "../constants.js";
import { getSigningIdentity } from "../util/getSigningIdentity.js";

const RELEASE_BRANCHES = ["main", "master"];

export const buildApp = (
  srcDir: string,
  schemeName: string,
  destinationSpecifier: string,
  teamId: string
) => {
  const gitStatus = execCommand("git", ["status", "-s"], {
    cwd: srcDir,
  });
  if (gitStatus.trim()) {
    throw new Error(
      "Git working directory is dirty. Please commit or stash changes before building."
    );
  }

  const currentBranch = execCommand(
    "git",
    ["rev-parse", "--abbrev-ref", "HEAD"],
    { cwd: srcDir }
  );
  if (!RELEASE_BRANCHES.includes(currentBranch.trim())) {
    throw new Error(
      `Not on release branch (current: ${currentBranch.trim()}). Please switch to ${RELEASE_BRANCHES.join(" or ")} branch.`
    );
  }

  const files = readdirSync(srcDir);
  if (!files.some((file) => file.endsWith(".xcodeproj"))) {
    throw new Error("Source directory must contain an .xcodeproj file");
  }

  getSigningIdentity(teamId);

  const archivesPath = join(srcDir, ".build/Archives");
  const exportsPath = join(srcDir, ".build/Exports");
  const derivedDataPath = join(srcDir, DERIVED_DATA_PATH);


  const schemeSettings = [
    "-scheme",
    schemeName,
  ];

  const destinationSettings = [
    "-destination",
    destinationSpecifier,
  ];

  const configurationSettings = [
    "-configuration",
    "Release",
  ];

  const derivedDataSettings = [
    "-derivedDataPath",
    derivedDataPath,
  ];

  const sharedSettings = [
    ...schemeSettings,
    ...destinationSettings,
    ...configurationSettings,
    ...derivedDataSettings,
    `DEVELOPMENT_TEAM=${teamId}`,
  ];

  green("Gathering build settings...");
  const stdout = execCommand(
    "xcodebuild",
    [
      ...schemeSettings,
      ...destinationSettings,
      ...configurationSettings,
      "-showBuildSettings",
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
        PRODUCT_NAME,
        MARKETING_VERSION,
        CURRENT_PROJECT_VERSION,
        CODE_SIGN_IDENTITY,
        CODE_SIGN_STYLE,
        DEVELOPMENT_TEAM,
      },
    },
  ] = json;


  const date = new Date();
  const timestamp = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
  const xcArchiveName = `${PRODUCT_NAME} ${timestamp}`;
  const xcArchivePath = join(archivesPath, `${xcArchiveName}.xcarchive`);

  const exportedArchivePath = join(exportsPath, xcArchiveName);
  const plistPath = join(exportedArchivePath, "ExportOptions.plist");
  const exportedAppPath = join(exportedArchivePath, `${PRODUCT_NAME}.app`);

  green(`Team ID: ${teamId}`);
  green(`Scheme: ${schemeName}`);
  green(`Product name: ${PRODUCT_NAME}`);
  green(`Version: ${MARKETING_VERSION}`);
  green(`Build: ${CURRENT_PROJECT_VERSION}`);
  green(`Code sign identity: ${CODE_SIGN_IDENTITY}`);
  green(`Code sign style: ${CODE_SIGN_STYLE}`);
  green(`Development team: ${DEVELOPMENT_TEAM}`);
  green(`Archive path: ${xcArchivePath}`);
  green(`Export path: ${exportedArchivePath}`);

  mkdirSync(archivesPath, { recursive: true });
  mkdirSync(exportedArchivePath, { recursive: true });

  green("Cleaning...");
  execCommand("xcodebuild", ["clean", ...sharedSettings,], { cwd: srcDir });

  green("Testing...");
  execCommand("xcodebuild", ["test", ...schemeSettings, ...derivedDataSettings, "-quiet"], { cwd: srcDir });

  green("Archiving...");
  execCommand(
    "xcodebuild",
    [
      "archive",
      "-archivePath",
      xcArchivePath,
      ...sharedSettings,
    ],
    { cwd: srcDir }
  );

  green("Exporting...");

  const exportOptionsPlist = {
    destination: "export",
    method: "developer-id",
    // signingStyle: "manual",
    // signingCertificate: "Developer ID Application",
    team: teamId,
  };

  writeFileSync(plistPath, plist.build(exportOptionsPlist));
  execCommand(
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
    { cwd: srcDir }
  );

  green("✓ App built:");
  green(exportedAppPath);

  return {
    exportedAppPath,
    productName: PRODUCT_NAME,
    version: MARKETING_VERSION,
    teamId,
  };
};
