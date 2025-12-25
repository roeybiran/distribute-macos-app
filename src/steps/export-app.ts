import {writeFileSync, mkdirSync} from 'node:fs';
import {join, basename} from 'node:path';
import plist from 'plist';
import {execa} from 'execa';
import {green} from '../util/colors.js';
import {exportsPath} from '../constants.js';

export const exportApp = async ({
	srcDir,
	xcArchivePath,
	productName,
	developmentTeam,
}: {
	srcDir: string;
	xcArchivePath: string;
	productName: string;
	developmentTeam: string;
}): Promise<{exportedAppPath: string}> => {
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
		team: developmentTeam,
	};

	writeFileSync(plistPath, plist.build(exportOptionsPlist));
	await execa({cwd: srcDir})`xcodebuild -exportArchive -archivePath ${xcArchivePath} -exportPath ${exportedArchivePathLocal} -exportOptionsPlist ${plistPath}`;

	green(`App exported: ${exportedAppPath}`);

	return {exportedAppPath};
};
