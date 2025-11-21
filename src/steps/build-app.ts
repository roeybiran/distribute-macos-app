import {mkdirSync, writeFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import plist from 'plist';
import {execCommand} from '../util/exec-command.js';
import {green} from '../util/colors.js';
import {derivedDataPath} from '../constants.js';
import {getSigningIdentity} from '../util/get-signing-identity.js';

const releaseBranches = ['main', 'master'];

export const buildApp = (
	srcDir: string,
	schemeName: string,
	destinationSpecifier: string,
	teamId: string,
) => {
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

	getSigningIdentity(teamId);

	const archivesPath = join(srcDir, '.build/Archives');
	const exportsPath = join(srcDir, '.build/Exports');
	const derivedDataPathLocal = join(srcDir, derivedDataPath);

	const schemeSettings = [
		'-scheme',
		schemeName,
	];

	const destinationSettings = [
		'-destination',
		destinationSpecifier,
	];

	const configurationSettings = [
		'-configuration',
		'Release',
	];

	const derivedDataSettings = [
		'-derivedDataPath',
		derivedDataPathLocal,
	];

	green('Gathering build settings...');
	const stdout = execCommand(
		'xcodebuild',
		[
			...schemeSettings,
			...destinationSettings,
			...configurationSettings,
			'-showBuildSettings',
			'-json',
		],
		{cwd: srcDir},
	);

	let json: any;
	try {
		json = JSON.parse(stdout);
	} catch (error) {
		console.log(stdout);
		throw error;
	}

	const [
		{
			buildSettings: {
				PRODUCT_NAME: productName,
				MARKETING_VERSION: marketingVersion,
				CURRENT_PROJECT_VERSION: currentProjectVersion,
				CODE_SIGN_IDENTITY: codeSignIdentity,
				CODE_SIGN_STYLE: codeSignStyle,
				DEVELOPMENT_TEAM: developmentTeam,
			},
		},
	] = json;

	const date = new Date();
	const timestamp = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
	const xcArchiveName = `${productName} ${timestamp}`;
	const xcArchivePath = join(archivesPath, `${xcArchiveName}.xcarchive`);

	const exportedArchivePath = join(exportsPath, xcArchiveName);
	const plistPath = join(exportedArchivePath, 'ExportOptions.plist');
	const exportedAppPath = join(exportedArchivePath, `${productName}.app`);

	green(`Team ID: ${teamId}`);
	green(`Scheme: ${schemeName}`);
	green(`Product name: ${productName}`);
	green(`Version: ${marketingVersion}`);
	green(`Build: ${currentProjectVersion}`);
	green(`Code sign identity: ${codeSignIdentity}`);
	green(`Code sign style: ${codeSignStyle}`);
	green(`Development team: ${developmentTeam}`);
	green(`Archive path: ${xcArchivePath}`);
	green(`Export path: ${exportedArchivePath}`);

	mkdirSync(archivesPath, {recursive: true});
	mkdirSync(exportedArchivePath, {recursive: true});

	green('Cleaning...');
	execCommand('xcodebuild', ['clean'], {cwd: srcDir});

	green('Testing...');
	execCommand('xcodebuild', ['test', ...schemeSettings, ...derivedDataSettings], {cwd: srcDir});

	green('Archiving...');
	execCommand(
		'xcodebuild',
		[
			'archive',
			'-archivePath',
			xcArchivePath,
			...schemeSettings,
			...destinationSettings,
			...configurationSettings,
			...derivedDataSettings,
			`DEVELOPMENT_TEAM=${teamId}`,
		],
		{cwd: srcDir},
	);

	green('Exporting...');

	const exportOptionsPlist = {
		destination: 'export',
		method: 'developer-id',
		// SigningStyle: "manual",
		// signingCertificate: "Developer ID Application",
		team: teamId,
	};

	writeFileSync(plistPath, plist.build(exportOptionsPlist));
	execCommand(
		'xcodebuild',
		[
			'-exportArchive',
			'-archivePath',
			xcArchivePath,
			'-exportPath',
			exportedArchivePath,
			'-exportOptionsPlist',
			plistPath,
		],
		{cwd: srcDir},
	);

	green('✓ App built:');
	green(exportedAppPath);

	return {
		exportedAppPath,
		productName,
		version: marketingVersion,
		teamId,
	};
};
