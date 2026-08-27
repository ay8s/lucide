import { promises as fs } from 'fs';
import path from 'path';

export type OutputFiles = Map<string, string | Uint8Array>;

const TEXT_EXTENSIONS = new Set(['.swift', '.md', '.json', '.gitignore', '']);

/**
 * Files the generator writes when they are missing but never overwrites, so a
 * repository can keep its own. They are left out of `--check` for the same
 * reason.
 */
const SEEDED_FILES = new Set(['.gitignore']);

function expandPlaceholders(value: string, variables: Record<string, string>): string {
  return value.replace(/\{\{([A-Z_]+)\}\}/g, (match, name: string) => {
    if (!(name in variables)) {
      throw new Error(`The template uses '${match}', which has no value.`);
    }

    return variables[name];
  });
}

async function listFiles(directory: string, prefix = ''): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(prefix, entry.name);

      if (entry.isDirectory()) {
        return listFiles(path.join(directory, entry.name), relativePath);
      }

      return [relativePath];
    }),
  );

  return files.flat();
}

/**
 * Reads the Swift package template, replacing `{{PLACEHOLDER}}` in file paths
 * and in the contents of text files.
 */
export async function readTemplate(
  templateDir: string,
  variables: Record<string, string>,
): Promise<OutputFiles> {
  const files: OutputFiles = new Map();

  for (const templatePath of await listFiles(templateDir)) {
    const absolutePath = path.join(templateDir, templatePath);
    const relativePath = expandPlaceholders(templatePath, variables);

    if (TEXT_EXTENSIONS.has(path.extname(relativePath))) {
      const contents = await fs.readFile(absolutePath, 'utf-8');

      files.set(relativePath, expandPlaceholders(contents, variables));
    } else {
      files.set(relativePath, new Uint8Array(await fs.readFile(absolutePath)));
    }
  }

  return files;
}

export async function writeFiles(targetDir: string, files: OutputFiles) {
  for (const [relativePath, contents] of files) {
    const absolutePath = path.join(targetDir, relativePath);

    if (SEEDED_FILES.has(relativePath) && (await exists(absolutePath))) {
      continue;
    }

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, contents);
  }
}

async function exists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);

    return true;
  } catch {
    return false;
  }
}

/** Removes the directories the generator owns, so stale files can't linger. */
export async function removeGeneratedDirectories(targetDir: string, directories: string[]) {
  for (const directory of directories) {
    await fs.rm(path.join(targetDir, directory), { recursive: true, force: true });
  }
}

/**
 * Compares what the generator would write against what is on disk, for `--check`
 * runs in CI.
 */
export async function findOutdatedFiles(targetDir: string, files: OutputFiles): Promise<string[]> {
  const outdated: string[] = [];

  for (const [relativePath, contents] of files) {
    if (SEEDED_FILES.has(relativePath)) continue;

    const absolutePath = path.join(targetDir, relativePath);

    let current: Buffer;

    try {
      current = await fs.readFile(absolutePath);
    } catch {
      outdated.push(relativePath);
      continue;
    }

    const expected =
      typeof contents === 'string' ? Buffer.from(contents, 'utf-8') : Buffer.from(contents);

    if (!current.equals(expected)) {
      outdated.push(relativePath);
    }
  }

  return outdated;
}
