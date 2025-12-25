import {execa} from 'execa';
import {blue, green} from './colors.js';

export const checkNotaryCredentials = async (profile: string): Promise<void> => {
	blue('Checking Notary credentials...');
	await execa`xcrun notarytool history -p ${profile}`;
	green(`Notary credentials OK, profile: ${profile}`);
};
