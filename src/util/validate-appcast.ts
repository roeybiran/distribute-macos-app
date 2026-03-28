import {readFileSync} from 'node:fs';

// Validate appcast.xml has unique Sparkle version fields
export const validateAppcast = (appcastPath: string): void => {
	const xmlContent = readFileSync(appcastPath, 'utf8');
	for (const [key, patterns] of [
		[
			'sparkle:version',
			[
				/<sparkle:version>([^<]+)<\/sparkle:version>/g,
				/\bsparkle:version=(["'])(.*?)\1/g,
			],
		],
		[
			'sparkle:shortVersionString',
			[
				/<sparkle:shortVersionString>([^<]+)<\/sparkle:shortVersionString>/g,
				/\bsparkle:shortVersionString=(["'])(.*?)\1/g,
			],
		],
	] as const) {
		const seen = new Set<string>();
		for (const pattern of patterns) {
			for (const match of xmlContent.matchAll(pattern)) {
				const value = match.at(-1)?.trim();
				if (!value) {
					continue;
				}

				if (seen.has(value)) {
					throw new Error(`Duplicate ${key} value: "${value}"`);
				}

				seen.add(value);
			}
		}
	}
};
