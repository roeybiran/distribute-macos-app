import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {execa} from 'execa';
import {green} from '../util/colors.js';
import {archivesPath, buildConfiguration} from '../constants.js';

export const archiveApp = async ({
	srcDir,
	scheme,
	releasePlatform,
	productName,
}: {
	srcDir: string;
	scheme: string;
	releasePlatform: string;
	productName: string;
}): Promise<{xcArchivePath: string}> => {
	const archivesPathLocal = join(srcDir, archivesPath);

	const date = new Date();
	const timestamp = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
	const xcArchiveName = `${productName} ${timestamp}`;
	const xcArchivePath = join(archivesPathLocal, `${xcArchiveName}.xcarchive`);

	mkdirSync(archivesPathLocal, {recursive: true});

	green('Cleaning...');
	await execa({cwd: srcDir})`xcodebuild clean`;

	green('Testing...');
	const sharedArgs = ['-scheme', scheme, '-quiet'];
	const testPlatform = 'platform=macOS,arch=arm64';
	try {
		await execa({cwd: srcDir})`xcodebuild build-for-testing ${sharedArgs} -destination ${testPlatform}`;
		await execa({cwd: srcDir})`xcodebuild test ${sharedArgs} -destination ${testPlatform}`;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (!errorMessage.includes('There are no test bundles available to test.')) {
			throw error;
		}

		green('No test bundles found. Skipping tests.');
	}

	green(`Archiving to: ${xcArchivePath}`);
	await execa({cwd: srcDir})`xcodebuild archive ${sharedArgs} -destination ${releasePlatform} -configuration ${buildConfiguration} -archivePath ${xcArchivePath}`;

	return {
		xcArchivePath,
	};
};
