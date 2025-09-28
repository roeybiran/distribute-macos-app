import { execa } from 'execa';
import chalk from 'chalk';

export const getSigningIdentity = async (teamId: string): Promise<string> => {
  const { stdout } = await execa('security', ['find-identity', '-vp', 'codesigning']);
  
  // security find-identity -vp codesigning, example output:
  // 1) <identity-hash> "Apple Development: <team-name> (<team-id>)"
  // 2) <identity-hash> "Developer ID Application: <team-name> (<team-id>)"
  //    2 valid identities found

  const identities = stdout
    .split('\n')
    .filter(line => line.includes('Developer ID Application') && line.includes(teamId))
    .map(line => {
      const match = line.match(/"([^"]+)"/);
      return match ? match[1] : '';
    })

  const identity = identities[0];

  if (!identity) {
    throw new Error(chalk.red('No codesign identity found. Aborting.'));
  } else if (identities.length > 1) {
    console.log(chalk.green('==>'), 'Found multiple suitable codesigning identities. Using the first:');
  } else {
    console.log(chalk.green('==>'), 'Using codesigning identity:');
  }
  console.log(chalk.green('==>'), identity);

  return identity;
};