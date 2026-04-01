import {
	writeFileSync, mkdirSync, existsSync, cpSync,
} from 'node:fs';
import {join, basename, resolve} from 'node:path';
import {execa} from 'execa';
import {green} from '../util/colors.js';
import {exportsPath} from '../constants.js';

export const exportApp = async ({
	srcDir,
	xcArchivePath,
	productName,
	developmentTeam,
	outputDir,
	// Override for integration tests: 'mac-application' works without a Developer ID cert.
	// Production always uses the default.
	method = 'developer-id',
}: {
	srcDir: string;
	xcArchivePath: string;
	productName: string;
	developmentTeam: string;
	outputDir?: string;
	method?: string;
}): Promise<{exportedAppPath: string; exportedDsymPath: string}> => {
	const xcArchiveName = basename(xcArchivePath, '.xcarchive');
	const exportsPathLocal = outputDir ? resolve(outputDir) : join(srcDir, exportsPath);
	const exportedArchivePathLocal = join(exportsPathLocal, xcArchiveName);
	const plistPath = join(exportedArchivePathLocal, 'ExportOptions.plist');
	const exportedAppPath = join(exportedArchivePathLocal, `${productName}.app`);
	const archivedDsymPath = join(xcArchivePath, 'dSYMs', `${productName}.app.dSYM`);
	const exportedDsymPath = join(exportedArchivePathLocal, `${productName}.app.dSYM`);

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

	if (!existsSync(archivedDsymPath)) {
		throw new Error(`Archived dSYM not found at ${archivedDsymPath}`);
	}

	cpSync(archivedDsymPath, exportedDsymPath, {recursive: true});

	green(`App exported: ${exportedAppPath}`);
	green(`dSYM exported: ${exportedDsymPath}`);

	return {exportedAppPath, exportedDsymPath};
};
