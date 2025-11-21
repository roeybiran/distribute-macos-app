import {writeFileSync, mkdirSync} from 'node:fs';
import {join, basename} from 'node:path';
import plist from 'plist';
import {execCommand} from '../util/exec-command.js';
import {green} from '../util/colors.js';
import {exportsPath} from '../constants.js';

export const exportApp = ({
	srcDir,
	xcArchivePath,
	productName,
	teamId,
}: {
	srcDir: string;
	xcArchivePath: string;
	productName: string;
	teamId: string;
}): {exportedAppPath: string} => {
	const xcArchiveName = basename(xcArchivePath, '.xcarchive');
	const exportsPathLocal = join(srcDir, exportsPath);
	const exportedArchivePathLocal = join(exportsPathLocal, xcArchiveName);
	const plistPath = join(exportedArchivePathLocal, 'ExportOptions.plist');
	const exportedAppPath = join(exportedArchivePathLocal, `${productName}.app`);

	green(`Export path: ${exportedArchivePathLocal}`);
	mkdirSync(exportedArchivePathLocal, {recursive: true});

	green('Exporting app...');

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
			exportedArchivePathLocal,
			'-exportOptionsPlist',
			plistPath,
		],
		{cwd: srcDir},
	);

	green(`✓ App exported: ${exportedAppPath}`);

	return {exportedAppPath};
};

