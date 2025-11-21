import {
	mkdirSync,
	copyFileSync,
	unlinkSync,
	globSync,
} from 'node:fs';
import {join, basename} from 'node:path';
import {execCommand} from '../util/exec-command.js';
import {checkSparklePrivateKey} from '../util/check-sparkle-private-key.js';
import {changelogToHtml} from '../util/changelog.js';
import {green, blue} from '../util/colors.js';

export const sparkle = ({
	dmgPath,
	srcDir,
	outDir,
	fullReleaseNotesUrl,
	appHomepage,
}: {
	srcDir: string;
	outDir: string;
	dmgPath?: string | undefined;
	fullReleaseNotesUrl?: string | undefined;
	appHomepage?: string | undefined;
}) => {
	blue('Checking Sparkle private key...');
	checkSparklePrivateKey();

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

	// Use the Sparkle tool from derived data path
	const appcastTool = join(
		srcDir,
		'.build/DerivedData/SourcePackages/artifacts/sparkle/Sparkle/bin/generate_appcast',
	);

	const args = ['--auto-prune-update-files', outDir];
	if (fullReleaseNotesUrl) {
		args.unshift('--full-release-notes-url', fullReleaseNotesUrl);
	}

	if (appHomepage) {
		args.unshift('--link', appHomepage);
	}

	execCommand(appcastTool, args);

	green('Deleting partial release note files...');
	const changelogFiles = globSync(`${changelogBasename} *.html`, {
		cwd: outDir,
	});
	for (const file of changelogFiles) {
		unlinkSync(join(outDir, file));
	}
};
