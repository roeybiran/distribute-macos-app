import {execa} from 'execa';
import {blue, green} from './colors.js';

export const checkDmgDependencies = async (): Promise<void> => {
	blue('Checking create-dmg dependencies...');
	const dependencies = ['create-dmg', 'gm', 'magick'];
	for (const dep of dependencies) {
		try {
			await execa`command -v ${dep}`;
		} catch {
			throw new Error(`${dep} is missing`);
		}
	}

	green('create-dmg dependencies OK');
};
