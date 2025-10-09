import { execCommand } from './execCommand.js';

export const checkNotaryCredentials = (profile: string): void => {
  try {
    execCommand('xcrun', ['notarytool', 'history', '-p', profile]);
  } catch {
    throw new Error(
      `No credential profile named ${profile} found in Keychain.\n` +
      'To create another credential profile, run:\n' +
      'xcrun notarytool store-credentials "${profile}" --key PATH_TO_PRIVATE_KEY --key-id KEY_ID --issuer ISSUER_ID\n' +
      'Generating the profile can be done through App Store Connect: https://appstoreconnect.apple.com/access/integrations/api\n' +
      'Learn more: https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api#Download-and-Store-a-Team-Private-Key'
    );
  }
};