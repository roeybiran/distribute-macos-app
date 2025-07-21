import { execa } from 'execa';
import chalk from 'chalk';

export const getSigningIdentity = async (teamId) => {
  const { stdout } = await execa('security', ['find-identity', '-vp', 'codesigning']);
  
  // security find-identity -vp codesigning, example output:
  // 1) <identity-hash> "Apple Development: <team-name> (<team-id>)"
  // 2) <identity-hash> "Developer ID Application: <team-name> (<team-id>)"
  //    2 valid identities found

  const identities = stdout
    .split('\n')
    .filter(line => line.includes('Developer ID Application') && line.includes(teamId))
    .map(line => line.match(/"([^"]+)"/)[1]);

  if (!identities.length) {
    throw new Error(chalk.red('No codesign identity found. Aborting.'));
  }

  const identity = identities[0];

  if (identities.length > 1) {
    console.log(chalk.green('==>'), 'Found multiple suitable codesigning identities. Using the first:');
  } else {
    console.log(chalk.green('==>'), 'Using codesigning identity:');
  }
  console.log(chalk.green('==>'), identity);

  return identity;
};