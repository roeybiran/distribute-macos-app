import {mkdirSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {execCommand} from '../util/exec-command.js';
import {green} from '../util/colors.js';
import {
	derivedDataPath,
	archivesPath,
	buildConfiguration,
} from '../constants.js';

const releaseBranches = ['main', 'master'];

export const archiveApp = ({
	srcDir,
	scheme,
	platform,
	productName,
	teamId,
}: {
	srcDir: string;
	scheme: string;
	platform: string;
	productName: string;
	teamId: string;
}): {xcArchivePath: string} => {
	const gitStatus = execCommand('git', ['status', '-s'], {
		cwd: srcDir,
	});
	if (gitStatus.trim()) {
		throw new Error('Git working directory is dirty. Please commit or stash changes before building.');
	}

	const currentBranch = execCommand(
		'git',
		['rev-parse', '--abbrev-ref', 'HEAD'],
		{cwd: srcDir},
	);
	if (!releaseBranches.includes(currentBranch.trim())) {
		throw new Error(`Not on release branch (current: ${currentBranch.trim()}). Please switch to ${releaseBranches.join(' or ')} branch.`);
	}

	const files = readdirSync(srcDir);
	if (!files.some(file => file.endsWith('.xcodeproj'))) {
		throw new Error('Source directory must contain an .xcodeproj file');
	}

	const archivesPathLocal = join(srcDir, archivesPath);
	const derivedDataPathLocal = join(srcDir, derivedDataPath);

	const date = new Date();
	const timestamp = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
	const xcArchiveName = `${productName} ${timestamp}`;
	const xcArchivePath = join(archivesPathLocal, `${xcArchiveName}.xcarchive`);

	mkdirSync(archivesPathLocal, {recursive: true});

	green('Cleaning...');
	execCommand('xcodebuild', ['clean'], {cwd: srcDir});

	const sharedArgs = ['-scheme', scheme, '-derivedDataPath', derivedDataPathLocal];
	green('Testing...');
	execCommand('xcodebuild', ['build-for-testing', '-quiet', '-destination', 'platform=macOS,arch=arm64', ...sharedArgs], {cwd: srcDir});
	execCommand('xcodebuild', ['test', '-quiet', '-destination', 'platform=macOS,arch=arm64', ...sharedArgs], {cwd: srcDir});

	green(`Archiving to: ${xcArchivePath}`);
	execCommand(
		'xcodebuild',
		[
			...sharedArgs,
			'archive',
			'-archivePath',
			xcArchivePath,
			'-configuration',
			buildConfiguration,
			'-destination',
			platform,
			`DEVELOPMENT_TEAM=${teamId}`,
		],
		{cwd: srcDir},
	);

	return {
		xcArchivePath,
	};
};
