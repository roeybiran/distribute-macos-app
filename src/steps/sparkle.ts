import {
	mkdirSync, copyFileSync, readFileSync, writeFileSync,
} from 'node:fs';
import {join, basename} from 'node:path';
import {execa} from 'execa';
import {green} from '../util/colors.js';
import {type BuildSettings} from '../util/get-build-settings.js';
import {resolveAppcastToolPath} from '../util/preflight.js';

type ReleaseNote = {
	body: string;
	date: string;
	version: string;
};

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
	const targetDmgPath = join(outDir, dmgName);
	const changelogMarkdown = readFileSync(changelogPath, 'utf8');
	const releaseHeadingMatches = [...changelogMarkdown.matchAll(/^##\s+(.+)\s*$/gm)]
		.filter(releaseHeadingMatch => releaseHeadingMatch[1].trim().length > 0);
	const releaseNotes: ReleaseNote[] = [];

	for (const [releaseIndex, releaseHeadingMatch] of releaseHeadingMatches.entries()) {
		const releaseHeading = releaseHeadingMatch[1].trim();
		const releaseHeadingParts = /^(?<version>.+?)(?:\s+-\s+(?<date>\d{4}-\d{2}-\d{2}|\?{3}))?$/.exec(releaseHeading);
		const releaseVersion = releaseHeadingParts?.groups?.version.trim() ?? releaseHeading;
		const releaseNotesEndIndex = releaseHeadingMatches[releaseIndex + 1]?.index ?? changelogMarkdown.length;
		const releaseNotesSource = changelogMarkdown.slice(
			releaseHeadingMatch.index + releaseHeadingMatch[0].length,
			releaseNotesEndIndex,
		);
		const releaseDate = releaseHeadingParts?.groups?.date?.trim()
			?? /^\s*Date:\s*(.+)\s*$/m.exec(releaseNotesSource)?.[1].trim();
		const releaseNotesBody = releaseNotesSource
			.replace(/^\s*Date:\s*.+\s*$/m, '')
			.trim();

		if (releaseVersion === '???') {
			continue;
		}

		const releaseNotesPath = join(outDir, `${buildSettings.PRODUCT_NAME} ${releaseVersion}.md`);
		const releaseNotesMarkdown = `## ${releaseVersion}\n\n${releaseNotesBody}\n`;
		writeFileSync(releaseNotesPath, releaseNotesMarkdown);

		if (releaseDate && releaseDate !== '???') {
			releaseNotes.push({
				body: releaseNotesBody,
				date: releaseDate,
				version: releaseVersion,
			});
		}
	}

	writeFileSync(join(outDir, 'release-notes.json'), `${JSON.stringify(releaseNotes, null, 2)}\n`);

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
