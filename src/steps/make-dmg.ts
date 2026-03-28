import {join, dirname, resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {type EventEmitter} from 'node:events';
import {execa} from 'execa';
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

const defaultWindowHeight = 480;
const defaultWindowWidth = 640;

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
	const shouldSkipCodeSigning = skipCodeSigning ?? false;
	const resolvedKeychainProfile = skipNotarization ? undefined : keychainProfile;

	if (!resolvedKeychainProfile && !skipNotarization) {
		throw new Error('keychainProfile is required unless skipNotarization is enabled.');
	}

	if (resolvedKeychainProfile) {
		await checkNotaryCredentials(resolvedKeychainProfile);
	}

	const identity = shouldSkipCodeSigning || !developmentTeam
		? null
		: await getSigningIdentity(developmentTeam);

	const outputDir = dirname(exportedAppPath);
	const dmgPath = join(outputDir, `${productName} ${marketingVersion}.dmg`);

	green('Creating and code signing DMG...');

	let resolvedBackgroundPath: string | undefined;
	const iconVerticalCenter = Math.round(defaultWindowHeight / 2);
	if (dmgBackground) {
		resolvedBackgroundPath = resolve(dmgBackground);
		if (!existsSync(resolvedBackgroundPath)) {
			throw new Error(`DMG background not found at ${resolvedBackgroundPath}`);
		}

		const retinaBackgroundPath = resolvedBackgroundPath.replace(/\.([a-z]+)$/, '@2x.$1');
		const {stdout: backgroundMetadata} = await execa`/usr/bin/sips -g pixelWidth -g pixelHeight ${resolvedBackgroundPath}`;
		const widthMatch = /pixelWidth:\s+(\d+)/.exec(backgroundMetadata);
		const heightMatch = /pixelHeight:\s+(\d+)/.exec(backgroundMetadata);
		if (!widthMatch || !heightMatch) {
			throw new Error(`Could not determine DMG background size for ${resolvedBackgroundPath}`);
		}

		const backgroundWidth = Number.parseInt(widthMatch[1], 10);
		const backgroundHeight = Number.parseInt(heightMatch[1], 10);
		if (backgroundWidth !== defaultWindowWidth || backgroundHeight !== defaultWindowHeight) {
			throw new Error(`DMG background must be ${defaultWindowWidth}x${defaultWindowHeight}. Got ${backgroundWidth}x${backgroundHeight} at ${resolvedBackgroundPath}`);
		}

		if (existsSync(retinaBackgroundPath)) {
			const {stdout: retinaBackgroundMetadata} = await execa`/usr/bin/sips -g pixelWidth -g pixelHeight ${retinaBackgroundPath}`;
			const retinaWidthMatch = /pixelWidth:\s+(\d+)/.exec(retinaBackgroundMetadata);
			const retinaHeightMatch = /pixelHeight:\s+(\d+)/.exec(retinaBackgroundMetadata);
			if (!retinaWidthMatch || !retinaHeightMatch) {
				throw new Error(`Could not determine DMG retina background size for ${retinaBackgroundPath}`);
			}

			const retinaBackgroundWidth = Number.parseInt(retinaWidthMatch[1], 10);
			const retinaBackgroundHeight = Number.parseInt(retinaHeightMatch[1], 10);
			if (retinaBackgroundWidth !== defaultWindowWidth * 2 || retinaBackgroundHeight !== defaultWindowHeight * 2) {
				const expectedRetinaSize = `${defaultWindowWidth * 2}x${defaultWindowHeight * 2}`;
				const actualRetinaSize = `${retinaBackgroundWidth}x${retinaBackgroundHeight}`;
				throw new Error(`DMG retina background must be ${expectedRetinaSize}. Got ${actualRetinaSize} at ${retinaBackgroundPath}`);
			}
		}
	}

	const spec: AppDmgSpecification = {
		title: productName,
		contents: [
			{
				x: 448, y: iconVerticalCenter, type: 'link', path: '/Applications',
			},
			{
				x: 192, y: iconVerticalCenter, type: 'file', path: exportedAppPath,
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
		const keychainProfileForNotarization = resolvedKeychainProfile;
		if (!keychainProfileForNotarization) {
			throw new Error('keychainProfile is required unless skipNotarization is enabled.');
		}

		try {
			await execa`xcrun stapler validate -q ${dmgPath}`;
		} catch {
			green('Notarizing DMG...');
			await execa`xcrun notarytool submit ${dmgPath} --keychain-profile=${keychainProfileForNotarization} --wait`;
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
