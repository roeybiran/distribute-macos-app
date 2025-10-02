import { execCommand } from "../util/execCommand.ts";
import { join, dirname } from "path";
import { getSigningIdentity } from "../util/getSigningIdentity.ts";
import { checkNotaryCredentials } from "../util/checkNotaryCredentials.ts";
import { checkDmgDependencies } from "../util/checkDmgDependencies.ts";
import { blue, green } from "../util/colors.ts";

export const dmg = ({
  exportedAppPath,
  productName,
  version,
  keychainProfile,
  teamId,
}: {
  exportedAppPath: string;
  productName: string;
  version: string;
  keychainProfile: string;
  teamId: string;
}) => {
  blue("Checking create-dmg dependencies...");
  checkDmgDependencies();

  blue("Checking Notary credentials...");
  checkNotaryCredentials(keychainProfile);

  const identity = getSigningIdentity(teamId);

  const outputDir = dirname(exportedAppPath);

  green("Creating and code signing DMG...");
  execCommand(
    "create-dmg",
    ["--overwrite", exportedAppPath, outputDir, `--identity=${identity}`]
  );

  const dmgPath = join(outputDir, `${productName} ${version}.dmg`);

  green(`Notarizing DMG...`);
  execCommand(
    "xcrun",
    [
      "notarytool",
      "submit",
      dmgPath,
      `--keychain-profile=${keychainProfile}`,
      "--wait",
    ]
  );

  // Staple
  green("Stapling DMG with notarization ticket...");
  execCommand("xcrun", ["stapler", "staple", dmgPath]);

  green("✓ DMG created:");
  green(dmgPath);

  return { dmgPath };
};
