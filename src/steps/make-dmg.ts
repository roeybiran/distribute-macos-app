import {join, dirname} from 'node:path';
import {execa} from 'execa';
import {getSigningIdentity} from '../util/get-signing-identity.js';
import {checkNotaryCredentials} from '../util/check-notary-credentials.js';
import {checkDmgDependencies} from '../util/check-dmg-dependencies.js';
import {green} from '../util/colors.js';

export const dmg = async ({
	exportedAppPath,
	productName,
	marketingVersion,
	keychainProfile,
	developmentTeam,
}: {
	exportedAppPath: string;
	productName: string;
	marketingVersion: string;
	keychainProfile: string;
	developmentTeam: string;
}) => {
	await checkDmgDependencies();
	await checkNotaryCredentials(keychainProfile);

	const identity = await getSigningIdentity(developmentTeam);

	const outputDir = dirname(exportedAppPath);

	green('Creating and code signing DMG...');
	await execa`create-dmg ${exportedAppPath} ${outputDir} --identity=${identity} --overwrite`;

	const dmgPath = join(outputDir, `${productName} ${marketingVersion}.dmg`);

	try {
		await execa`xcrun stapler validate -q ${dmgPath}`;
	} catch {
		green('Notarizing DMG...');
		await execa`xcrun notarytool submit ${dmgPath} --keychain-profile=${keychainProfile} --wait`;
		green('Stapling DMG with notarization ticket...');
		await execa`xcrun stapler staple ${dmgPath}`;
	}

	green('DMG created:');
	green(dmgPath);

	return {dmgPath};
};
