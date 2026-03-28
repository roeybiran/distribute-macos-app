import {writeFileSync} from 'node:fs';
import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {changelogToHtml} from './make-changelog.js';

vi.mock('node:fs', () => ({
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	mkdirSync: vi.fn(),
}));

// Import readFileSync after mock is set up so we get the mocked version
const {readFileSync} = await import('node:fs');

const validYaml = `
- version: 1.1.0
  date: 2024-01-15
  new:
    - First new feature
    - Second new feature
  change:
    - Improved performance
  fix:
    - Fixed a critical bug
  issue:
    - Known issue with some edge case

- version: 1.0.0
  date: 2024-01-01
  new:
    - Initial release
    - {Some category: [Sub-item one, Sub-item two]}
`.trim();

describe('changelogToHtml', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('valid YAML → writeFileSync called with HTML containing expected sections', () => {
		vi.mocked(readFileSync).mockReturnValue(validYaml);

		changelogToHtml('/fake/changelog.yaml', 'TestApp', '/fake/out');

		const {calls} = vi.mocked(writeFileSync).mock;
		// Called once per entry + once for the full changelog
		expect(calls.length).toBe(3);

		// Per-version file contains entry sections
		const firstVersionContent = calls[0][1] as string;
		expect(firstVersionContent).toContain('New');
		expect(firstVersionContent).toContain('Changes');
		expect(firstVersionContent).toContain('Fixes');
		expect(firstVersionContent).toContain('Known Issues');
		expect(firstVersionContent).toContain('First new feature');
		expect(firstVersionContent).toContain('Fixed a critical bug');

		// Second version has object items with nested list
		const secondVersionContent = calls[1][1] as string;
		expect(secondVersionContent).toContain('Sub-item one');
		expect(secondVersionContent).toContain('Some category');
	});

	it('YAML is not an array → throws', () => {
		vi.mocked(readFileSync).mockReturnValue('not-an-array: value');

		expect(() => {
			changelogToHtml('/fake/changelog.yaml', 'TestApp', '/fake/out');
		}).toThrow('Changelog YAML must be a top-level array');
	});

	it('entry missing version → throws', () => {
		const yaml = `
- date: 2024-01-15
  new:
    - Feature without version
`.trim();
		vi.mocked(readFileSync).mockReturnValue(yaml);

		expect(() => {
			changelogToHtml('/fake/changelog.yaml', 'TestApp', '/fake/out');
		}).toThrow('must have version and date fields');
	});

	it('entry missing date → throws', () => {
		const yaml = `
- version: 1.0.0
  new:
    - Feature without date
`.trim();
		vi.mocked(readFileSync).mockReturnValue(yaml);

		expect(() => {
			changelogToHtml('/fake/changelog.yaml', 'TestApp', '/fake/out');
		}).toThrow('must have version and date fields');
	});

	it('invalid semver → throws', () => {
		const yaml = `
- version: "not-a-version"
  date: 2024-01-15
  new:
    - Feature
`.trim();
		vi.mocked(readFileSync).mockReturnValue(yaml);

		expect(() => {
			changelogToHtml('/fake/changelog.yaml', 'TestApp', '/fake/out');
		}).toThrow('Invalid version format');
	});

	it('string items render as list items', () => {
		const yaml = `
- version: 1.0.0
  date: 2024-01-01
  new:
    - Plain string item
`.trim();
		vi.mocked(readFileSync).mockReturnValue(yaml);

		changelogToHtml('/fake/changelog.yaml', 'TestApp', '/fake/out');

		const content = vi.mocked(writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain('Plain string item');
		expect(content).toContain('<li>');
	});

	it('object items with nested array render as nested lists', () => {
		const yaml = `
- version: 1.0.0
  date: 2024-01-01
  new:
    - {Category label: [Child item A, Child item B]}
`.trim();
		vi.mocked(readFileSync).mockReturnValue(yaml);

		changelogToHtml('/fake/changelog.yaml', 'TestApp', '/fake/out');

		const content = vi.mocked(writeFileSync).mock.calls[0][1] as string;
		expect(content).toContain('Category label');
		expect(content).toContain('Child item A');
		expect(content).toContain('Child item B');
		expect(content).toContain('<ul>');
	});
});
