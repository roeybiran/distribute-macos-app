import { execCommand } from './execCommand.js';

export const checkSparklePrivateKey = (): void => {
  try {
    execCommand('security', ['find-generic-password', '-l', 'Private key for signing Sparkle updates']);
  } catch {
    throw new Error('Sparkle private key not found. Run `generate_keys -f PRIVATE_KEY_PATH` to add an existing key to your keychain.');
  }
};