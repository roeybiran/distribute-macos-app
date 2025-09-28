import { execa } from 'execa';
import { join, dirname } from 'path';
import { getSigningIdentity } from '../util/getSigningIdentity.ts';
import { checkNotaryCredentials } from '../util/checkNotaryCredentials.ts';
import { checkDmgDependencies } from '../util/checkDmgDependencies.ts';
import { green } from '../util/colors.ts';

export const dmg = async ({ exportedAppPath, productName, version, keychainProfile, teamId }: {
  exportedAppPath: string;
  productName: string;
  version: string;
  keychainProfile: string;
  teamId: string;
}) => {
  await checkDmgDependencies()
  
  await checkNotaryCredentials(keychainProfile)

  const identity = await getSigningIdentity(teamId);

  const outputDir = dirname(exportedAppPath);
  
  // Create and sign DMG
  green('==> Creating and code signing DMG...');
  await execa('create-dmg', ['--overwrite', exportedAppPath, outputDir, `--identity=${identity}`], { stdio: 'inherit' });

  const dmgPath = join(outputDir, `${productName} ${version}.dmg`);

  green(`==> Notarizing DMG at path ${dmgPath}...`);
  await execa('xcrun', ['notarytool', 'submit', dmgPath, `--keychain-profile=${keychainProfile}`, '--wait'], { stdio: 'inherit' });

  // Staple
  green('==> Stapling DMG with notarization ticket...');
  await execa('xcrun', ['stapler', 'staple', dmgPath], { stdio: 'inherit' });

  return { dmgPath };
};
