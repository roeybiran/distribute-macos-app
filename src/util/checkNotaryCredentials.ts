import { green } from './colors.js';
import { execCommand } from './execCommand.js';

export const checkNotaryCredentials = (profile: string): void => {
  execCommand("xcrun", ["notarytool", "history", "-p", profile]);
  green(`Notary credentials OK, profile: ${profile}`);
};