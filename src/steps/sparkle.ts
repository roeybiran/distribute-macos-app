import {
	mkdirSync, copyFileSync, readFileSync, writeFileSync,
} from 'node:fs';
import {join, basename} from 'node:path';
import {execa} from 'execa';
import {green} from '../util/colors.js';
import {type BuildSettings} from '../util/get-build-settings.js';
import {resolveAppcastToolPath} from '../util/preflight.js';

export const sparkle = async ({
	dmgPath,
	srcDir,
	outDir,
	buildSettings,
	fullReleaseNotesUrl,
	appHomepage,
}: {
	srcDir: string;
	outDir: string;
	buildSettings: BuildSettings;
	dmgPath: string;
	fullReleaseNotesUrl?: string | undefined;
	appHomepage?: string | undefined;
}) => {
	const changelogPath = join(srcDir, 'CHANGELOG.md');

	mkdirSync(outDir, {recursive: true});

	const dmgName = basename(dmgPath);
	const releaseNotesPath = join(outDir, `${basename(dmgPath, '.dmg')}.md`);
	const targetDmgPath = join(outDir, dmgName);
	const releaseNotesMarkdown = readFileSync(changelogPath, 'utf8');
	writeFileSync(releaseNotesPath, releaseNotesMarkdown);
	green(`Copying DMG to ${targetDmgPath}...`);
	copyFileSync(dmgPath, targetDmgPath);

	green('Generating Appcast.xml...');
	const appcastTool = resolveAppcastToolPath(buildSettings);

	const args: string[] = [];
	if (fullReleaseNotesUrl) {
		args.push('--full-release-notes-url', fullReleaseNotesUrl);
	}

	if (appHomepage) {
		args.push('--link', appHomepage);
	}

	args.push('--auto-prune-update-files', outDir);

	await execa(appcastTool, args);
};
