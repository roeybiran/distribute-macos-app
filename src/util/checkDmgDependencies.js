import { execa } from 'execa';
import chalk from 'chalk';

export const checkDmgDependencies = async () => {
  const dependencies = ['create-dmg', 'gm', 'magick'];
  for (const dep of dependencies) {
    try {
      await execa('command', ['-v', dep]);
    } catch {
      throw new Error(chalk.red(`${dep} is missing`));
    }
  }
};