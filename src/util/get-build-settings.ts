import {buildConfiguration} from '../constants.js';
import {execCommand} from './exec-command.js';

export const getBuildSettings = ({
	srcDir,
	scheme,
	destinationSpecifier = 'generic/platform=macOS',
}: {
	srcDir: string;
	scheme: string;
	destinationSpecifier?: string;
}) => {
	const args = [
		'-scheme',
		scheme,
		'-destination',
		destinationSpecifier,
		'-configuration',
		buildConfiguration,
		'-showBuildSettings',
		'-json',
	];

	const stdout = execCommand('xcodebuild', args, {cwd: srcDir});

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

