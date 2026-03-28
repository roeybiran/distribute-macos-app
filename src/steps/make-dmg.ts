import {join, dirname, resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {type EventEmitter} from 'node:events';
import {execa} from 'execa';
import {dmgAppCenterX, dmgAppsFolderCenterX, dmgIconCenterY} from '../constants.js';
import {getSigningIdentity} from '../util/get-signing-identity.js';
import {checkNotaryCredentials} from '../util/check-notary-credentials.js';
import {green} from '../util/colors.js';

type AppDmgContentItem = {
	path: string;
	type: 'file' | 'link';
	x: number;
	y: number;
};

type AppDmgSpecification = {
	background?: string;
	'code-sign'?: {
		'signing-identity': string;
	};
	contents: AppDmgContentItem[];
	title: string;
};

const require = createRequire(import.meta.url);
const appdmg = require('appdmg') as (options: {
	basepath: string;
	specification: AppDmgSpecification;
	target: string;
}) => EventEmitter;

const runAppDmg = async (spec: AppDmgSpecification, target: string, basepath: string): Promise<void> =>
	new Promise((resolve, reject) => {
		const ee = appdmg({target, basepath, specification: spec});
		ee.on('finish', resolve);
		ee.on('error', reject);
	});

export const dmg = async ({
	exportedAppPath,
	productName,
	marketingVersion,
	keychainProfile,
	developmentTeam,
	dmgBackground,
	skipCodeSigning,
	skipNotarization,
	skipSuccessLog,
}: {
	exportedAppPath: string;
	productName: string;
	marketingVersion: string;
	keychainProfile?: string;
	developmentTeam?: string;
	dmgBackground?: string;
	skipCodeSigning?: boolean;
	skipNotarization?: boolean;
	skipSuccessLog?: boolean;
}) => {
	const resolvedKeychainProfile = skipNotarization ? undefined : keychainProfile;

	if (!resolvedKeychainProfile && !skipNotarization) {
		throw new Error('keychainProfile is required unless skipNotarization is enabled.');
	}

	if (resolvedKeychainProfile) {
		await checkNotaryCredentials(resolvedKeychainProfile);
	}

	const identity = (skipCodeSigning ?? false) || !developmentTeam
		? null
		: await getSigningIdentity(developmentTeam);

	const outputDir = dirname(exportedAppPath);
	const dmgPath = join(outputDir, `${productName} ${marketingVersion}.dmg`);

	green('Creating and code signing DMG...');

	const resolvedBackgroundPath = dmgBackground ? resolve(dmgBackground) : undefined;
	if (resolvedBackgroundPath && !existsSync(resolvedBackgroundPath)) {
		throw new Error(`DMG background not found at ${resolvedBackgroundPath}`);
	}

	const spec: AppDmgSpecification = {
		title: productName,
		contents: [
			{
				x: dmgAppsFolderCenterX, y: dmgIconCenterY, type: 'link', path: '/Applications',
			},
			{
				x: dmgAppCenterX, y: dmgIconCenterY, type: 'file', path: exportedAppPath,
			},
		],
	};

	if (resolvedBackgroundPath) {
		spec.background = resolvedBackgroundPath;
	}

	if (identity) {
		spec['code-sign'] = {'signing-identity': identity};
	}

	await runAppDmg(spec, dmgPath, outputDir);

	if (!skipNotarization) {
		try {
			await execa`xcrun stapler validate -q ${dmgPath}`;
		} catch {
			green('Notarizing DMG...');
			await execa`xcrun notarytool submit ${dmgPath} --keychain-profile=${resolvedKeychainProfile!} --wait`;
			green('Stapling DMG with notarization ticket...');
			await execa`xcrun stapler staple ${dmgPath}`;
		}
	}

	if (!skipSuccessLog) {
		green('DMG created:');
		green(dmgPath);
	}

	return {dmgPath};
};
