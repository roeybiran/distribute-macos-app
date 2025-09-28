import { execa } from 'execa';
import { red } from './colors.ts';

export const checkDmgDependencies = async (): Promise<void> => {
  const dependencies = ['create-dmg', 'gm', 'magick'];
  for (const dep of dependencies) {
    try {
      await execa('command', ['-v', dep]);
    } catch {
      throw new Error(`${dep} is missing`);
    }
  }
};