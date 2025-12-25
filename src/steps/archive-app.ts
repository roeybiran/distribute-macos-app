import {mkdirSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {execa} from 'execa';
import {green} from '../util/colors.js';
import {archivesPath, buildConfiguration} from '../constants.js';

const releaseBranches = ['main', 'master'];

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
	const {stdout: gitStatus} = await execa({cwd: srcDir})`git status -s`;
	if (gitStatus.trim()) {
		throw new Error(
			'Git working directory is dirty. Please commit or stash changes before building.',
		);
	}

	const {stdout: currentBranch} = await execa({cwd: srcDir})`git rev-parse --abbrev-ref HEAD`;
	if (!releaseBranches.includes(currentBranch.trim())) {
		throw new Error(
			`Not on release branch (current: ${currentBranch.trim()}). Please switch to ${releaseBranches.join(' or ')} branch.`,
		);
	}

	const files = readdirSync(srcDir);
	if (!files.some((file) => file.endsWith('.xcodeproj'))) {
		throw new Error('Source directory must contain an .xcodeproj file');
	}

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
	await execa({cwd: srcDir})`xcodebuild build-for-testing ${sharedArgs} -destination ${testPlatform}`;
	await execa({cwd: srcDir})`xcodebuild test ${sharedArgs} -destination ${testPlatform}`;

	green(`Archiving to: ${xcArchivePath}`);
	await execa({cwd: srcDir})`xcodebuild archive ${sharedArgs} -destination ${releasePlatform} -configuration ${buildConfiguration} -archivePath ${xcArchivePath}`;

	return {
		xcArchivePath,
	};
};
