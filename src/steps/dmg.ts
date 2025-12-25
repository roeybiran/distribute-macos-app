import {join, dirname} from 'node:path';
import {execaSync} from 'execa';
import {execCommand} from '../util/exec-command.js';
import {getSigningIdentity} from '../util/get-signing-identity.js';
import {checkNotaryCredentials} from '../util/check-notary-credentials.js';
import {checkDmgDependencies} from '../util/check-dmg-dependencies.js';
import {green} from '../util/colors.js';

export const dmg = ({
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
	checkDmgDependencies();
	checkNotaryCredentials(keychainProfile);

	const identity = getSigningIdentity(developmentTeam);

	const outputDir = dirname(exportedAppPath);

	green('Creating and code signing DMG...');
	try {
		execaSync('create-dmg', [
			exportedAppPath,
			outputDir,
			`--identity=${identity}`,
		]);
	} catch (error) {
		if (
			!(error instanceof Error)
			|| !error.message.includes('already exists')
		) {
			throw error;
		}
	}

	const dmgPath = join(outputDir, `${productName} ${marketingVersion}.dmg`);

	green('Notarizing DMG...');
	const staplerValidation = execaSync('/usr/bin/stapler', [
		'validate',
		'-q',
		dmgPath,
	]);

	if (staplerValidation.exitCode !== 0) {
		execCommand('xcrun', [
			'notarytool',
			'submit',
			dmgPath,
			`--keychain-profile=${keychainProfile}`,
			'--wait',
		]);
		// Staple
		green('Stapling DMG with notarization ticket...');
		execCommand('xcrun', ['stapler', 'staple', dmgPath]);
	}

	green('✓ DMG created:');
	green(dmgPath);

	return {dmgPath};
};
