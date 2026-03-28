import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import prettier from '@prettier/sync';
import yaml from 'js-yaml';
import markdownit from 'markdown-it';

type ChangelogItem = string | Record<string, ChangelogItem[]>;
type ChangelogSectionName = 'new' | 'change' | 'fix' | 'issue';
type ChangelogEntry = {
	change?: ChangelogItem[];
	date: Date | string;
	fix?: ChangelogItem[];
	issue?: ChangelogItem[];
	new?: ChangelogItem[];
	note?: string[];
	version: string;
};

const sectionNames: ChangelogSectionName[] = ['new', 'change', 'fix', 'issue'];

const sectionTitles: Record<ChangelogSectionName, string> = {
	new: 'New',
	change: 'Changes',
	fix: 'Fixes',
	issue: 'Known Issues',
};

// Configure markdown-it
const md = markdownit({
	html: true,
	typographer: true,
});

export const changelogToHtml = (
	changelogPath: string,
	appName: string,
	outDir: string,
) => {
	const yamlContent = readFileSync(changelogPath, 'utf8');
	const entries = yaml.load(yamlContent);

	if (!Array.isArray(entries)) {
		throw new TypeError('Changelog YAML must be a top-level array');
	}

	const sections = entries.map((entry, index) => {
		if (typeof entry !== 'object' || entry === null) {
			throw new TypeError(`Entry at index ${index} must be an object`);
		}

		const entryRecord = entry as Record<string, unknown>;
		const {version, date} = entryRecord;

		// Validate required fields
		if (typeof version !== 'string' || (!(date instanceof Date) && typeof date !== 'string')) {
			throw new TypeError(`Entry at index ${index} must have version and date fields`);
		}

		// Validate version format (semver)
		if (!isValidSemver(version)) {
			throw new Error(`Invalid version format at index ${index}: "${version}". Must follow semver format (e.g., 1.0.0 or 1.16)`);
		}

		const typedEntry: ChangelogEntry = {version, date};

		// Handle optional notes array
		let notes = '';
		const noteValue = entryRecord.note;
		if (noteValue !== undefined) {
			if (!Array.isArray(noteValue) || noteValue.some(note => typeof note !== 'string')) {
				throw new TypeError(`Note must be an array at index ${index}`);
			}

			const typedNotes = noteValue as string[];
			typedEntry.note = typedNotes;
			const notesContent = typedNotes
				.map(note => md.render(note))
				.join('');
			notes = `<div class="note">${notesContent}</div>`;
		}

		for (const sectionName of sectionNames) {
			const section = entryRecord[sectionName];
			if (section === undefined) {
				continue;
			}

			if (!Array.isArray(section)) {
				throw new TypeError(`${sectionName} must be an array at index ${index}`);
			}

			typedEntry[sectionName] = section as ChangelogItem[];
		}

		// Create sections for each type of change
		const newSection = makeSection(typedEntry, 'new');
		const changeSection = makeSection(typedEntry, 'change');
		const fixSection = makeSection(typedEntry, 'fix');
		const issueSection = makeSection(typedEntry, 'issue');

		const content = formatHtml([notes, newSection, changeSection, fixSection, issueSection].join('\n'));

		writeFileSync(join(outDir, `${appName} ${version}.html`), content);

		return {version, date, content};
	});

	const fullChangelog = sections
		.map(section => {
			const dateObject = new Date(section.date);
			const formattedDate = dateObject.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
			});
			// Format date for datetime attribute
			const datetime = dateObject.toISOString().split('T')[0];
			return `
        <section class="changelog-section">
          <header class="changelog-section__header">
            <h2>${section.version}</h2>
            <time datetime="${datetime}" class="changelog-section__date">${formattedDate}</time>
          </header>
          <div class="changelog-section__content">
            ${section.content}
          </div>
        </section>
      `.trim();
		})
		.join('\n');

	writeFileSync(join(outDir, `${appName}.html`), formatHtml(fullChangelog));
};

const makeSection = (entry: ChangelogEntry, type: ChangelogSectionName): string => {
	const items = entry[type];
	if (!items || !Array.isArray(items) || items.length === 0) {
		return '';
	}

	const listItems = items.map(item => itemToHtml(item)).join('');

	return `
    <div class="entry">
      <p class="entry-label entry-label__${type}">${sectionTitles[type]}</p>
      <ul class="entry-list entry-list__${type}">
        ${listItems}
      </ul>
    </div>
  `.trim();
};

const itemToHtml = (item: string | Record<string, unknown>): string => {
	if (typeof item === 'string') {
		return `<li>${md.renderInline(item)}</li>`;
	}

	if (item && typeof item === 'object') {
		const entries = Object.entries(item);
		if (entries.length === 0) {
			return '';
		}

		return entries
			.map(([key, value]) => {
				if (!Array.isArray(value)) {
					throw new TypeError(`Value for key "${key}" must be an array`);
				}

				const nestedValues = value as ChangelogItem[];
				const nestedItems: string = nestedValues
					.map(item => itemToHtml(item))
					.join('');
				return `
        <li>
          ${md.renderInline(key)}:
          <ul>
            ${nestedItems}
          </ul>
        </li>`.trim();
			})
			.join('\n');
	}

	throw new TypeError('List items must be strings or objects with string keys and array values');
};

const formatHtml = (html: string): string => {
	try {
		return prettier.format(html, {parser: 'html'});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.warn('Failed to format HTML:', errorMessage);
		return html; // Return original HTML if formatting fails
	}
};

const isValidSemver = (version: string): boolean => {
	const semverRegex
		= /^(0|[1-9]\d*)(?:\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?)?(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][\da-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][\da-zA-Z-]*))*))?(?:\+([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?$/;
	return semverRegex.test(version);
};
