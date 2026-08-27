import { promises as fs } from 'fs';
import path from 'path';
import { parseArgs } from 'util';
import { fileURLToPath } from 'url';

import { collectIcons } from './collectIcons.ts';
import { downloadFontAssets, readFontAssets } from './fontAssets.ts';
import {
  generateAliasesFile,
  generateIconsFile,
  generateIndexJson,
  generateMetadataFile,
  generateRemovedFile,
  generateTestConstantsFile,
  type GenerationContext,
} from './generateSwift.ts';
import { parseSfnt } from './parseSfnt.ts';
import { readIconMetadata } from './readIconMetadata.ts';
import {
  findOutdatedFiles,
  readTemplate,
  removeGeneratedDirectories,
  writeFiles,
  type OutputFiles,
} from './writePackage.ts';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(currentDir, '../../../');
const templateDir = path.join(currentDir, '../template');

const { values } = parseArgs({
  options: {
    version: { type: 'string', default: 'latest' },
    'font-dir': { type: 'string' },
    'icons-dir': { type: 'string' },
    out: { type: 'string' },
    module: { type: 'string', default: 'LucideIcons' },
    'repo-url': { type: 'string' },
    check: { type: 'boolean', default: false },
  },
});

const moduleName = values.module;

if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(moduleName)) {
  throw new Error(`'${moduleName}' is not a usable Swift module name.`);
}

const targetDir = path.resolve(values.out ?? path.join(repoRoot, 'lucide-swift'));
const repositoryUrl = values['repo-url'] ?? `https://github.com/your-org/${moduleName}.git`;

const sourcesDir = `Sources/${moduleName}`;
const testsDir = `Tests/${moduleName}Tests`;
const generatedDirectories = [
  `${sourcesDir}/Generated`,
  `${sourcesDir}/Resources`,
  `${testsDir}/Generated`,
];
const iconsDir = path.resolve(values['icons-dir'] ?? path.join(repoRoot, 'icons'));

const assets = values['font-dir']
  ? await readFontAssets(path.resolve(values['font-dir']), values.version)
  : await downloadFontAssets(values.version);

const font = parseSfnt(assets.font);
const metadata = await readIconMetadata(iconsDir);

const iconSet = collectIcons({
  codePoints: assets.codePoints,
  coveredCodePoints: font.coveredCodePoints,
  metadata,
});

if (iconSet.icons.length === 0) {
  throw new Error('No icons were found, refusing to generate an empty package.');
}

const context: GenerationContext = {
  lucideVersion: assets.lucideVersion,
  moduleName,
  familyName: font.familyName,
  postScriptName: font.postScriptName,
  fontFileName: 'lucide',
};

const previousNames = await readPreviousIconNames(targetDir);

const files: OutputFiles = await readTemplate(templateDir, {
  MODULE: moduleName,
  PACKAGE_URL: repositoryUrl,
  LUCIDE_VERSION: context.lucideVersion,
  ICON_COUNT: String(iconSet.icons.length),
  ALIAS_COUNT: String(iconSet.aliases.length),
  REMOVED_COUNT: String(iconSet.removed.length),
  FONT_FAMILY: context.familyName,
});

files.set(`${sourcesDir}/Generated/LucideIcon+Icons.swift`, generateIconsFile(iconSet, context));
files.set(
  `${sourcesDir}/Generated/LucideIcon+Aliases.swift`,
  generateAliasesFile(iconSet, context),
);
files.set(
  `${sourcesDir}/Generated/LucideIcon+Removed.swift`,
  generateRemovedFile(iconSet, context),
);
files.set(
  `${sourcesDir}/Generated/LucideFont+Metadata.swift`,
  generateMetadataFile(iconSet, context),
);
files.set(`${sourcesDir}/Resources/lucide-icons.json`, generateIndexJson(iconSet, context));
files.set(`${sourcesDir}/Resources/${context.fontFileName}.ttf`, assets.font);
files.set(
  `${testsDir}/Generated/GeneratedIcons.swift`,
  generateTestConstantsFile(iconSet, context),
);

// The package version mirrors the lucide-static release, so a release script can
// read the tag straight out of the checkout.
files.set('.lucide-version', `${context.lucideVersion}\n`);

const license = await readLicense();

if (license) {
  files.set('LICENSE', license);
}

if (values.check) {
  const outdated = await findOutdatedFiles(targetDir, files);

  if (outdated.length > 0) {
    console.error(
      [
        `${outdated.length} file(s) in ${targetDir} are not what lucide-static@${context.lucideVersion} generates:`,
        ...outdated.map((file) => `  ${file}`),
        '',
        'Run `pnpm build:swift` to update them.',
      ].join('\n'),
    );

    process.exit(1);
  }

  console.log(`${targetDir} is up to date with lucide-static@${context.lucideVersion}.`);
} else {
  await removeGeneratedDirectories(targetDir, generatedDirectories);
  await writeFiles(targetDir, files);
}

report();

async function readLicense(): Promise<string | null> {
  try {
    return await fs.readFile(path.join(repoRoot, 'LICENSE'), 'utf-8');
  } catch {
    return null;
  }
}

/** The icon names of the package that is already in `targetDir`, if any. */
async function readPreviousIconNames(directory: string): Promise<Set<string> | null> {
  try {
    const contents = await fs.readFile(
      path.join(directory, sourcesDir, 'Resources/lucide-icons.json'),
      'utf-8',
    );

    const { icons } = JSON.parse(contents) as { icons: Record<string, number> };

    return new Set(Object.keys(icons));
  } catch {
    return null;
  }
}

function report() {
  console.log(
    [
      `module: ${moduleName}`,
      `lucide-static: ${context.lucideVersion}`,
      `font: ${font.familyName} (${font.versionString ?? 'unknown version'})`,
      `icons: ${iconSet.icons.length}`,
      `alternative names: ${iconSet.aliases.length}`,
      `removed names: ${iconSet.removed.length}`,
      `version to tag the package with: ${context.lucideVersion}`,
    ].join('\n'),
  );

  if (previousNames) {
    const names = new Set(iconSet.icons.map((icon) => icon.name));
    const added = [...names].filter((name) => !previousNames.has(name));
    const gone = [...previousNames].filter((name) => !names.has(name));

    if (added.length > 0) {
      console.log(`added since the last run (${added.length}): ${added.join(', ')}`);
    }

    if (gone.length > 0) {
      console.log(`gone since the last run (${gone.length}): ${gone.join(', ')}`);
    }

    if (added.length === 0 && gone.length === 0) {
      console.log('no icons were added or removed since the last run.');
    }
  }

  if (iconSet.unreleased.length > 0) {
    console.log(
      `not in the font yet, no code point allocated (${iconSet.unreleased.length}): ${iconSet.unreleased.join(', ')}`,
    );
  }

  for (const warning of iconSet.warnings) {
    console.warn(`warning: ${warning}`);
  }
}
