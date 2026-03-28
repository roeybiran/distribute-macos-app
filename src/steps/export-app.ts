import {writeFileSync, mkdirSync} from 'node:fs';
import {join, basename} from 'node:path';
import {execa} from 'execa';
import {green} from '../util/colors.js';
import {exportsPath} from '../constants.js';

export const exportApp = async ({
	srcDir,
	xcArchivePath,
	productName,
	developmentTeam,
	// Override for integration tests: 'mac-application' works without a Developer ID cert.
	// Production always uses the default.
	method = 'developer-id',
}: {
	srcDir: string;
	xcArchivePath: string;
	productName: string;
	developmentTeam: string;
	method?: string;
}): Promise<{exportedAppPath: string}> => {
	const xcArchiveName = basename(xcArchivePath, '.xcarchive');
	const exportsPathLocal = join(srcDir, exportsPath);
	const exportedArchivePathLocal = join(exportsPathLocal, xcArchiveName);
	const plistPath = join(exportedArchivePathLocal, 'ExportOptions.plist');
	const exportedAppPath = join(exportedArchivePathLocal, `${productName}.app`);

	green(`Export path: ${exportedArchivePathLocal}`);
	mkdirSync(exportedArchivePathLocal, {recursive: true});

	green('Exporting app...');
	writeFileSync(plistPath, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>destination</key>
	<string>export</string>
	<key>method</key>
	<string>${method}</string>
	<key>team</key>
	<string>${developmentTeam}</string>
</dict>
</plist>
`);
	await execa({cwd: srcDir})`xcodebuild -exportArchive -archivePath ${xcArchivePath} -exportPath ${exportedArchivePathLocal} -exportOptionsPlist ${plistPath}`;

	green(`App exported: ${exportedAppPath}`);

	return {exportedAppPath};
};
