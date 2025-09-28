import { execa } from 'execa';
import { red } from './colors.ts';

export const checkSparklePrivateKey = async (): Promise<void> => {
  try {
    await execa('security', ['find-generic-password', '-l', 'Private key for signing Sparkle updates']);
  } catch {
    throw new Error('Sparkle private key not found. Run `generate_keys -f PRIVATE_KEY_PATH` to add an existing key to your keychain.');
  }
};