import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {execa, type Result} from 'execa';
import {getSigningIdentity} from './get-signing-identity.js';

vi.mock('execa', () => ({execa: vi.fn()}));

// One matching Developer ID Application identity for TEAM1234AB
const oneMatchOutput = `
  1) ABCDEF1234567890ABCDEF1234567890ABCDEF12 "Developer ID Application: Test Developer (TEAM1234AB)"
  2) ABCDEF1234567890ABCDEF1234567890ABCDEF13 "Apple Development: Test Developer (TEAM1234AB)"
     2 valid identities found
`.trim();

// Two matching Developer ID Application identities for TEAM1234AB
const twoMatchOutput = `
  1) ABCDEF1234567890ABCDEF1234567890ABCDEF12 "Developer ID Application: Test Developer (TEAM1234AB)"
  2) ABCDEF1234567890ABCDEF1234567890ABCDEF14 "Developer ID Application: Another Cert (TEAM1234AB)"
  3) ABCDEF1234567890ABCDEF1234567890ABCDEF13 "Apple Development: Test Developer (TEAM1234AB)"
     3 valid identities found
`.trim();

// No matching Developer ID Application identity for TEAM1234AB
const noMatchOutput = `
  1) ABCDEF1234567890ABCDEF1234567890ABCDEF13 "Apple Development: Other Developer (OTHERTEAM)"
     1 valid identities found
`.trim();

const makeExecaResult = (stdout: string): Result => {
	const result = {stdout};
	return result as unknown as Result;
};

describe('getSigningIdentity', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('one matching identity → returns the identity string', async () => {
		vi.mocked(execa).mockResolvedValue(makeExecaResult(oneMatchOutput));

		const identity = await getSigningIdentity('TEAM1234AB');

		expect(identity).toBe('Developer ID Application: Test Developer (TEAM1234AB)');
	});

	it('multiple matching identities → returns the first one (no throw)', async () => {
		vi.mocked(execa).mockResolvedValue(makeExecaResult(twoMatchOutput));

		const identity = await getSigningIdentity('TEAM1234AB');

		expect(identity).toBe('Developer ID Application: Test Developer (TEAM1234AB)');
	});

	it('no matching identity → throws', async () => {
		vi.mocked(execa).mockResolvedValue(makeExecaResult(noMatchOutput));

		await expect(getSigningIdentity('TEAM1234AB')).rejects.toThrow('No codesign identity found');
	});
});
