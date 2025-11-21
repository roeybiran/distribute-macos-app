import {execSync} from 'node:child_process';
import {green} from '../util/colors.js';

export const github = async ({dmgPath, version}: {dmgPath: string; version: string}) => {
	green('Pulling + rebasing...');
	execSync('git pull --rebase', {stdio: 'inherit'});
	green('Pushing...');
	execSync('git push', {stdio: 'inherit'});
	green('Pushing tags...');
	execSync('git push --tags', {stdio: 'inherit'});
	green('Creating GitHub Release...');
	const releaseNotes = execSync('git log -1 --pretty=%B').toString().trim();
	execSync(`gh release create "${version}" --notes "${releaseNotes}" "${dmgPath}"`, {stdio: 'inherit'});
};
