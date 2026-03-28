import {
	mkdirSync, copyFileSync, unlinkSync, globSync,
} from 'node:fs';
import {join, basename} from 'node:path';
import {execa} from 'execa';
import {changelogToHtml} from '../util/make-changelog.js';
import {green} from '../util/colors.js';
import {type BuildSettings, getBuildSettings} from '../util/get-build-settings.js';
import {resolveAppcastToolPath} from '../util/preflight.js';

export const sparkle = async ({
	dmgPath,
	srcDir,
	outDir,
	scheme,
	buildSettings,
	fullReleaseNotesUrl,
	appHomepage,
}: {
	srcDir: string;
	outDir: string;
	scheme: string;
	buildSettings?: BuildSettings;
	dmgPath?: string | undefined;
	fullReleaseNotesUrl?: string | undefined;
	appHomepage?: string | undefined;
}) => {
	const changelogBasename = basename(srcDir);
	const changelogPath = join(srcDir, 'CHANGELOG.yaml');

	changelogToHtml(changelogPath, changelogBasename, outDir);
	// Create sparkle directory if it doesn't exist
	mkdirSync(outDir, {recursive: true});

	// Copy DMG to sparkle directory
	if (dmgPath) {
		const dmgName = basename(dmgPath);
		const targetDmgPath = join(outDir, dmgName);
		green(`Copying DMG to ${targetDmgPath}...`);
		copyFileSync(dmgPath, targetDmgPath);
	}

	green('Generating Appcast.xml...');

	const resolvedBuildSettings = buildSettings ?? await getBuildSettings({
		srcDir,
		scheme,
	});
	const appcastTool = resolveAppcastToolPath(resolvedBuildSettings);

	const args: string[] = [];
	if (fullReleaseNotesUrl) {
		args.push('--full-release-notes-url', fullReleaseNotesUrl);
	}

	if (appHomepage) {
		args.push('--link', appHomepage);
	}

	args.push('--auto-prune-update-files', outDir);

	await execa(appcastTool, args);

	green('Deleting partial release note files...');
	const changelogFiles = globSync(`${changelogBasename} *.html`, {
		cwd: outDir,
	});
	for (const file of changelogFiles) {
		unlinkSync(join(outDir, file));
	}
};
