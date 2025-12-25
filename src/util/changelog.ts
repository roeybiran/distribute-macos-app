import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import prettier from '@prettier/sync';
import yaml from 'js-yaml';
import markdownit from 'markdown-it';

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
		// Validate required fields
		if (!entry.version || !entry.date) {
			throw new Error(
				`Entry at index ${index} must have version and date fields`,
			);
		}

		// Validate version format (semver)
		if (!isValidSemver(entry.version)) {
			throw new Error(
				`Invalid version format at index ${index}: "${entry.version}". Must follow semver format (e.g., 1.0.0 or 1.16)`,
			);
		}

		// Handle optional notes array
		let notes = '';
		if (entry.note) {
			if (!Array.isArray(entry.note)) {
				throw new TypeError(`Note must be an array at index ${index}`);
			}

			const notesContent = entry.note
				.map((note: string) => md.render(note))
				.join('');
			notes = `<div class="note">${notesContent}</div>`;
		}

		// Create sections for each type of change
		const newSection = makeSection(entry, 'new');
		const changeSection = makeSection(entry, 'change');
		const fixSection = makeSection(entry, 'fix');
		const issueSection = makeSection(entry, 'issue');

		const content = formatHtml(
			[notes, newSection, changeSection, fixSection, issueSection].join('\n'),
		);

		writeFileSync(join(outDir, `${appName} ${entry.version}.html`), content);

		return {version: entry.version, date: entry.date, content};
	});

	const fullChangelog = sections
		.map((section) => {
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

const makeSection = (entry: any, type: string): string => {
	const items = entry[type];
	if (!items || !Array.isArray(items) || items.length === 0) {
		return '';
	}

	const titles: Record<string, string> = {
		new: 'New',
		change: 'Changes',
		fix: 'Fixes',
		issue: 'Known Issues',
	};

	const listItems = items.map((item) => itemToHtml(item)).join('');

	return `
    <div class="entry">
      <p class="entry-label entry-label__${type}">${titles[type]}</p>
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

				const nestedItems: string = value
					.map((item) => itemToHtml(item))
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

	throw new Error(
		'List items must be strings or objects with string keys and array values',
	);
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
	const semverRegex =
		/^(0|[1-9]\d*)(?:\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?)?(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][\da-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][\da-zA-Z-]*))*))?(?:\+([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?$/;
	return semverRegex.test(version);
};
