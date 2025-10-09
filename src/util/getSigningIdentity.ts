import { execCommand } from './execCommand.js';
import { green } from './colors.js';

export const getSigningIdentity = (teamId: string): string => {
  const stdout = execCommand('security', ['find-identity', '-vp', 'codesigning']);
  
  // security find-identity -vp codesigning, example output:
  // 1) <identity-hash> "Apple Development: <team-name> (<team-id>)"
  // 2) <identity-hash> "Developer ID Application: <team-name> (<team-id>)"
  //    2 valid identities found

  const identities = stdout
    .split('\n')
    .filter((line) => line.includes('Developer ID Application') && line.includes(teamId))
    .map((line) => {
      const match = line.match(/"([^"]+)"/);
      return match ? match[1] : '';
    })

  const identity = identities[0];

  if (!identity) {
    throw new Error('No codesign identity found. Aborting.');
  } else if (identities.length > 1) {
    green(`Found multiple suitable codesigning identities. Using the first: ${identity}`);
  } else {
    green(`Using codesigning identity: ${identity}`);
  }

  return identity;
};