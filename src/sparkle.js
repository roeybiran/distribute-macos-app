import { execa } from 'execa';
import chalk from 'chalk';
import { mkdirSync, copyFileSync, unlinkSync, globSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import prettier from "@prettier/sync";
import yaml from "js-yaml";
import markdownit from "markdown-it";
import { checkSparklePrivateKey } from './util/checkSparklePrivateKey.js';

export const sparkle = async ({ dmgPath, srcDir, outDir, fullReleaseNotesUrl, appHomepage, derivedDataPath }) => {
  await checkSparklePrivateKey()

  const changelogBasename = basename(srcDir);
  const changelogPath = join(srcDir, 'CHANGELOG.yaml');
  if (existsSync(changelogPath)) {
    try {
      changelogToHtml(changelogPath, changelogBasename, outDir);
      console.log(chalk.green('==> Generated release notes from changelog.yml'));
    } catch (error) {
      console.log(chalk.red(`==> Error generating release notes: ${error.message}`));
    }
  } else {
    throw new Error(chalk.red(`No changelog.yml found (looked for ${changelogPath})`));
  }

  // Create sparkle directory if it doesn't exist
  mkdirSync(outDir, { recursive: true });
  
  // Copy DMG to sparkle directory
  const dmgName = basename(dmgPath);
  const targetDmgPath = join(outDir, dmgName);
  console.log(chalk.green(`==> Copying DMG to ${targetDmgPath}...`));
  copyFileSync(dmgPath, targetDmgPath);

  console.log(chalk.green('==> Generating Appcast.xml...'));
  
  // Use the Sparkle tool from derived data path
  const appcastTool = join(derivedDataPath, 'SourcePackages/artifacts/sparkle/Sparkle/bin/generate_appcast');
  
  if (!existsSync(appcastTool)) {
    console.log(chalk.red(`Couldn't find the Sparkle generate_appcast tool at ${appcastTool}. Make sure Sparkle framework is built. Aborting`));
    process.exit(1);
  }

  await execa(appcastTool, [
    '--full-release-notes-url',
    fullReleaseNotesUrl,
    '--link',
    appHomepage,
    '--auto-prune-update-files',
    outDir
  ], { stdio: 'inherit' });

  console.log(chalk.green('==> Deleting partial release note files...'));
  const changelogFiles = globSync(`${changelogBasename} *.html`, { cwd: outDir });
  for (const file of changelogFiles) {
    unlinkSync(join(outDir, file));
  }
};

 


// Configure markdown-it
const md = markdownit({
  html: true,
  typographer: true,
});

/**
 * Converts a YAML changelog to HTML release notes
 * @param {string} changelogPath - Path to the changelog YAML file
 * @returns {string} HTML string of the release notes
 */
const changelogToHtml = (changelogPath, appName, outDir) => {
  try {
    const yamlContent = readFileSync(changelogPath, "utf-8");
    const entries = yaml.load(yamlContent);

    if (!Array.isArray(entries)) {
      throw new Error("Changelog YAML must be a top-level array");
    }

    const sections = entries.map((entry, index) => {
      // Validate required fields
      if (!entry.version || !entry.date) {
        throw new Error(
          `Entry at index ${index} must have version and date fields`
        );
      }

      // Validate version format (semver)
      if (!isValidSemver(entry.version)) {
        throw new Error(
          `Invalid version format at index ${index}: "${entry.version}". Must follow semver format (e.g., 1.0.0 or 1.16)`
        );
      }

      // Handle optional notes array
      let notes = "";
      if (entry.note) {
        if (!Array.isArray(entry.note)) {
          throw new Error(`Note must be an array at index ${index}`);
        }
        const notesContent = entry.note.map((note) => md.render(note)).join("");
        notes = `<div class="note">${notesContent}</div>`;
      }

      // Create sections for each type of change
      const newSection = makeSection(entry, "new");
      const changeSection = makeSection(entry, "change");
      const fixSection = makeSection(entry, "fix");
      const issueSection = makeSection(entry, "issue");

      const content = formatHtml(
        [notes, newSection, changeSection, fixSection, issueSection].join("\n")
      );

      writeFileSync(join(outDir, `${appName} ${entry.version}.html`), content);

      return { version: entry.version, date: entry.date, content };
    });

    const fullChangelog = sections
      .map((section) => {
        const dateObj = new Date(section.date);
        const formattedDate = dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        // Format date for datetime attribute
        const datetime = dateObj.toISOString().split("T")[0];
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
      .join("\n");

    writeFileSync(join(outDir, `${appName}.html`), formatHtml(fullChangelog));

  } catch (error) {
    throw new Error(`Failed to convert changelog to HTML: ${error.message}`);
  }
}

const makeSection = (entry, type) => {
  const items = entry[type];
  if (!items || !Array.isArray(items) || items.length === 0) return "";

  const titles = {
    new: "New",
    change: "Changes",
    fix: "Fixes",
    issue: "Known Issues",
  };

  const listItems = items.map(itemToHtml).join("");

  return `
    <div class="entry">
      <p class="entry-label entry-label__${type}">${titles[type]}</p>
      <ul class="entry-list entry-list__${type}">
        ${listItems}
      </ul>
    </div>
  `.trim();
}

/**
 * Recursively converts a list item to HTML
 * @param {string|Object} item - The list item (string or object with key-value pairs)
 * @returns {string} HTML representation of the item
 */
const itemToHtml = (item) => {
  if (typeof item === "string") {
    return `<li>${md.renderInline(item)}</li>`;
  }

  if (item && typeof item === "object") {
    const entries = Object.entries(item);
    if (entries.length === 0) return "";

    return entries
      .map(([key, value]) => {
        if (!Array.isArray(value)) {
          throw new Error(`Value for key "${key}" must be an array`);
        }

        const nestedItems = value.map(itemToHtml).join("");
        return `
        <li>
          ${md.renderInline(key)}:
          <ul>
            ${nestedItems}
          </ul>
        </li>`
        .trim();
      })
      .join("\n");
  }

  throw new Error(
    "List items must be strings or objects with string keys and array values"
  );
}

/**
 * Formats HTML string using prettier
 * @param {string} html - HTML string to format
 * @returns {string} Formatted HTML string
 */
const formatHtml = (html) => {
  try {
    return prettier.format(html, { parser: "html" });
  } catch (error) {
    console.warn("Failed to format HTML:", error.message);
    return html; // Return original HTML if formatting fails
  }
}

/**
 * Validates if a string is a valid semver version
 * @param {string} version - Version string to validate
 * @returns {boolean} Whether the version is valid
 */
const isValidSemver = (version) => {
  const semverRegex =
    /^(0|[1-9]\d*)(?:\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?)?(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return semverRegex.test(version);
}