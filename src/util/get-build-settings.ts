import {execa} from 'execa';
import {buildConfiguration} from '../constants.js';

export type BuildSettings = Record<string, string> & {
	BUILD_DIR: string;
	CODE_SIGN_IDENTITY: string;
	CODE_SIGN_STYLE: string;
	CURRENT_PROJECT_VERSION: string;
	DEVELOPMENT_TEAM: string;
	MARKETING_VERSION: string;
	PRODUCT_NAME: string;
};

export const getBuildSettings = async ({
	srcDir,
	scheme,
	destinationSpecifier = 'generic/platform=macOS',
}: {
	srcDir: string;
	scheme: string;
	destinationSpecifier?: string;
}): Promise<BuildSettings> => {
	const {stdout} = await execa({cwd: srcDir})`xcodebuild -scheme ${scheme} -destination ${destinationSpecifier} -configuration ${buildConfiguration} -showBuildSettings -json`;

	let json: unknown;
	try {
		json = JSON.parse(stdout);
	} catch (error) {
		console.log(stdout);
		throw error;
	}

	if (!Array.isArray(json) || json.length === 0) {
		throw new TypeError('xcodebuild returned no build settings');
	}

	const firstResult: unknown = json[0];
	if (typeof firstResult !== 'object' || firstResult === null) {
		throw new TypeError('xcodebuild returned an invalid build settings payload');
	}

	const {buildSettings} = firstResult as {buildSettings?: unknown};
	if (typeof buildSettings !== 'object' || buildSettings === null) {
		throw new TypeError('xcodebuild response is missing buildSettings');
	}

	return buildSettings as BuildSettings;
};
