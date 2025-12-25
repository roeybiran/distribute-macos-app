import {execa} from 'execa';
import {buildConfiguration} from '../constants.js';

export const getBuildSettings = async ({
	srcDir,
	scheme,
	destinationSpecifier = 'generic/platform=macOS',
}: {
	srcDir: string;
	scheme: string;
	destinationSpecifier?: string;
}) => {
	const {stdout} = await execa({cwd: srcDir})`xcodebuild -scheme ${scheme} -destination ${destinationSpecifier} -configuration ${buildConfiguration} -showBuildSettings -json`;

	let json: any;
	try {
		json = JSON.parse(stdout);
	} catch (error) {
		console.log(stdout);
		throw error;
	}

	const [{buildSettings}] = json;
	return buildSettings;
};
