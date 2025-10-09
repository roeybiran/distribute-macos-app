import { execCommand } from './execCommand.js';

export const checkDmgDependencies = (): void => {
  const dependencies = ['create-dmg', 'gm', 'magick'];
  for (const dep of dependencies) {
    try {
      execCommand('command', ['-v', dep]);
    } catch {
      throw new Error(`${dep} is missing`);
    }
  }
};