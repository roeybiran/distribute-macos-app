import {existsSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {execa} from 'execa';
import {checkNotaryCredentials} from './check-notary-credentials.js';
import {checkSparklePrivateKey} from './check-sparkle-private-key.js';
import {green, blue} from './colors.js';
import {type BuildSettings} from './get-build-settings.js';
import {getSigningIdentity} from './get-signing-identity.js';

const appcastToolRelativePath = 'SourcePackages/artifacts/sparkle/Sparkle/bin/generate_appcast';
const releaseBranches = ['main', 'master'];

export const resolveAppcastToolPath = (buildSettings: BuildSettings): string =>
	join(dirname(dirname(buildSettings.BUILD_DIR)), appcastToolRelativePath);

export const preflightRelease = async ({
	srcDir,
	keychainProfile,
	buildSettings,
	includeSparkle,
}: {
	srcDir: string;
	keychainProfile: string;
	buildSettings: BuildSettings;
	includeSparkle: boolean;
}): Promise<void> => {
	blue('Running release preflight checks...');

	const {stdout: gitStatus} = await execa({cwd: srcDir})`git status -s`;
	if (gitStatus.trim()) {
		throw new Error('Git working directory is dirty. Please commit or stash changes before building.');
	}

	const {stdout: currentBranch} = await execa({cwd: srcDir})`git rev-parse --abbrev-ref HEAD`;
	if (!releaseBranches.includes(currentBranch.trim())) {
		throw new Error(`Not on release branch (current: ${currentBranch.trim()}). Please switch to ${releaseBranches.join(' or ')} branch.`);
	}

	const files = readdirSync(srcDir);
	if (!files.some(file => file.endsWith('.xcodeproj'))) {
		throw new Error('Source directory must contain an .xcodeproj file');
	}

	await checkNotaryCredentials(keychainProfile);
	await getSigningIdentity(buildSettings.DEVELOPMENT_TEAM);

	if (includeSparkle) {
		const changelogPath = join(srcDir, 'CHANGELOG.md');
		if (!existsSync(changelogPath)) {
			throw new Error(`CHANGELOG.md not found at ${changelogPath}`);
		}

		const appcastToolPath = resolveAppcastToolPath(buildSettings);
		if (!existsSync(appcastToolPath)) {
			throw new Error(`Sparkle generate_appcast not found at ${appcastToolPath}. Resolve Swift package dependencies before releasing.`);
		}

		await checkSparklePrivateKey();
	}

	green('Release preflight checks passed.');
};
