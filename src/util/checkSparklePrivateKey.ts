import { execa } from 'execa';
import chalk from 'chalk';

export const checkSparklePrivateKey = async (): Promise<void> => {
  try {
    await execa('security', ['find-generic-password', '-l', 'Private key for signing Sparkle updates']);
  } catch {
    throw new Error(chalk.red('Sparkle private key not found. Run `generate_keys -f PRIVATE_KEY_PATH` to add an existing key to your keychain.'));
  }
};