import {readFileSync} from 'node:fs';

// Validate appcast.xml has incrementing versions
export const validateAppcast = (appcastPath: string): void => {
	const xmlContent = readFileSync(appcastPath, 'utf8');
	const versionRegex = /<sparkle:version>([^<]+)<\/sparkle:version>/g;
	const matches = [...xmlContent.matchAll(versionRegex)];
	const versions = matches.map(match => Number.parseInt(match[1].trim(), 10));

	for (let i = 1; i < versions.length; i++) {
		const previousVersion = versions[i - 1];
		const currentVersion = versions[i];
		if (currentVersion >= previousVersion) {
			const errorMessage
				= `Invalid version ordering: sparkle:version "${currentVersion}" at position ${i + 1} should be less than previous version "${previousVersion}" (items should be ordered newest to oldest)`;
			throw new Error(errorMessage);
		}
	}
};

