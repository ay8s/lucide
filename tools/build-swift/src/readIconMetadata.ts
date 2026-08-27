import { promises as fs } from 'fs';
import path from 'path';

import type { IconMetadata } from './collectIcons.ts';

/**
 * Reads the repository's `icons/*.json`, which is where the canonical names,
 * their aliases and the deprecations live.
 *
 * Returns an empty record when the directory isn't there, so the generator can
 * also run against nothing but a published font.
 */
export async function readIconMetadata(iconsDir: string): Promise<Record<string, IconMetadata>> {
  let entries: string[];

  try {
    entries = await fs.readdir(iconsDir);
  } catch {
    return {};
  }

  const metadataFiles = entries.filter((entry) => path.extname(entry) === '.json');

  const metadata = await Promise.all(
    metadataFiles.map(async (entry) => {
      const contents = await fs.readFile(path.join(iconsDir, entry), 'utf-8');

      return [path.basename(entry, '.json'), JSON.parse(contents) as IconMetadata] as const;
    }),
  );

  return Object.fromEntries(metadata);
}
