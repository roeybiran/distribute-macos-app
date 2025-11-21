import {execCommand} from './exec-command.js';
import {blue, green} from './colors.js';

export const checkDmgDependencies = (): void => {
	blue('Checking create-dmg dependencies...');
	const dependencies = ['create-dmg', 'gm', 'magick'];
	for (const dep of dependencies) {
		try {
			execCommand('command', ['-v', dep]);
		} catch {
			throw new Error(`${dep} is missing`);
		}
	}

	green('create-dmg dependencies OK');
};
