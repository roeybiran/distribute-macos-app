import {readFileSync} from 'node:fs';
import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {validateAppcast} from './validate-appcast.js';

vi.mock('node:fs', () => ({readFileSync: vi.fn()}));

const validXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <item>
      <sparkle:version>1</sparkle:version>
      <sparkle:shortVersionString>1.0.0</sparkle:shortVersionString>
    </item>
    <item>
      <sparkle:version>3</sparkle:version>
      <sparkle:shortVersionString>1.1.0</sparkle:shortVersionString>
    </item>
    <item>
      <sparkle:version>2</sparkle:version>
      <sparkle:shortVersionString>1.0.1</sparkle:shortVersionString>
    </item>
  </channel>
</rss>`;

const duplicateVersionXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <item>
      <sparkle:version>1</sparkle:version>
      <sparkle:shortVersionString>1.0.0</sparkle:shortVersionString>
    </item>
    <item>
      <sparkle:version>1</sparkle:version>
      <sparkle:shortVersionString>1.0.1</sparkle:shortVersionString>
    </item>
  </channel>
</rss>`;

const duplicateShortVersionXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <item>
      <sparkle:version>1</sparkle:version>
      <sparkle:shortVersionString>1.0.0</sparkle:shortVersionString>
    </item>
    <item>
      <sparkle:version>2</sparkle:version>
      <sparkle:shortVersionString>1.0.0</sparkle:shortVersionString>
    </item>
  </channel>
</rss>`;

const validAttributeXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <item>
      <enclosure sparkle:version="3" sparkle:shortVersionString="1.1.0" />
    </item>
    <item>
      <enclosure sparkle:version="1" sparkle:shortVersionString="1.0.0" />
    </item>
    <item>
      <enclosure sparkle:version="2" sparkle:shortVersionString="1.0.1" />
    </item>
  </channel>
</rss>`;

describe('validateAppcast', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('unique versions and short versions in any order → no throw', () => {
		vi.mocked(readFileSync).mockReturnValue(validXml);
		expect(() => {
			validateAppcast('/fake/appcast.xml');
		}).not.toThrow();
	});

	it('duplicate sparkle:version values → throws', () => {
		vi.mocked(readFileSync).mockReturnValue(duplicateVersionXml);
		expect(() => {
			validateAppcast('/fake/appcast.xml');
		}).toThrow('Duplicate sparkle:version value: "1"');
	});

	it('duplicate sparkle:shortVersionString values → throws', () => {
		vi.mocked(readFileSync).mockReturnValue(duplicateShortVersionXml);
		expect(() => {
			validateAppcast('/fake/appcast.xml');
		}).toThrow('Duplicate sparkle:shortVersionString value: "1.0.0"');
	});

	it('Sparkle enclosure attributes with unique values → no throw', () => {
		vi.mocked(readFileSync).mockReturnValue(validAttributeXml);
		expect(() => {
			validateAppcast('/fake/appcast.xml');
		}).not.toThrow();
	});
});
