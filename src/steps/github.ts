import { execSync } from 'child_process';
import chalk from 'chalk';

export const github = async ({ dmgPath, version }: { dmgPath: string; version: string }) => {
  console.log(chalk.green('==>'), 'Pulling + rebasing...');
  execSync('git pull --rebase', { stdio: 'inherit' });
  console.log(chalk.green('==>'), 'Pushing...');
  execSync('git push', { stdio: 'inherit' });
  console.log(chalk.green('==>'), 'Pushing tags...');
  execSync('git push --tags', { stdio: 'inherit' });
  console.log(chalk.green('==>'), 'Creating GitHub Release...');
  const releaseNotes = execSync('git log -1 --pretty=%B').toString().trim();
  execSync(`gh release create "${version}" --notes "${releaseNotes}" "${dmgPath}"`, { stdio: 'inherit' });
};
