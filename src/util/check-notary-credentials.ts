import {blue, green} from './colors.js';
import {execCommand} from './exec-command.js';

export const checkNotaryCredentials = (profile: string): void => {
	blue('Checking Notary credentials...');
	execCommand('xcrun', ['notarytool', 'history', '-p', profile]);
	green(`Notary credentials OK, profile: ${profile}`);
};
