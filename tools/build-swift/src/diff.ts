import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { parseArgs } from 'util';
import { fileURLToPath } from 'url';

import { diffIndexes, formatDiff, type IconIndex } from './diffIndexes.ts';

const run = promisify(execFile);

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(currentDir, '../../../');

const { values } = parseArgs({
  options: {
    from: { type: 'string' },
    to: { type: 'string', default: 'working' },
    repo: { type: 'string' },
    json: { type: 'string' },
  },
});

if (!values.from) {
  throw new Error(
    'Pass --from=<version|ref|path>, and --to to compare against something other than the working tree.',
  );
}

const packageDir = path.resolve(values.repo ?? path.join(repoRoot, 'lucide-swift'));

const from = await readIndex(values.from);
const to = await readIndex(values.to);
const diff = diffIndexes(from, to);

process.stdout.write(formatDiff(diff));

if (values.json) {
  const contents = `${JSON.stringify(diff, null, 2)}\n`;

  if (values.json === '-') {
    process.stdout.write(contents);
  } else {
    await fs.writeFile(path.resolve(values.json), contents);
    console.log(`wrote ${path.resolve(values.json)}`);
  }
}

if (diff.movedCodePoints.length > 0) {
  console.error(
    `error: ${diff.movedCodePoints.length} icon(s) changed code point, which Lucide never does. The two indexes are not what they claim to be.`,
  );

  process.exit(1);
}

/**
 * Reads an icon index from a file, from the package's working tree, or from a
 * git ref of the package repository, so any two releases can be compared
 * without checking either of them out.
 */
async function readIndex(reference: string): Promise<IconIndex> {
  if (reference !== 'working') {
    const asPath = path.resolve(reference);

    if (await isFile(asPath)) {
      return JSON.parse(await fs.readFile(asPath, 'utf-8')) as IconIndex;
    }
  }

  const indexPath = await findIndexPath(reference);

  if (reference === 'working') {
    return JSON.parse(await fs.readFile(path.join(packageDir, indexPath), 'utf-8')) as IconIndex;
  }

  const { stdout } = await git(['show', `${reference}:${indexPath}`]);

  return JSON.parse(stdout) as IconIndex;
}

/** The index lives under the module's name, which can differ between refs. */
async function findIndexPath(reference: string): Promise<string> {
  const pattern = /^Sources\/[^/]+\/Resources\/lucide-icons\.json$/;

  if (reference === 'working') {
    const sources = path.join(packageDir, 'Sources');
    const modules = await fs.readdir(sources).catch(() => {
      throw new Error(`'${sources}' is not a generated package, pass --repo.`);
    });

    for (const moduleName of modules) {
      const candidate = `Sources/${moduleName}/Resources/lucide-icons.json`;

      if (await isFile(path.join(packageDir, candidate))) return candidate;
    }

    throw new Error(`Could not find an icon index in '${packageDir}'.`);
  }

  const { stdout } = await git(['ls-tree', '-r', '--name-only', reference]);
  const indexPath = stdout.split('\n').find((file) => pattern.test(file.trim()));

  if (!indexPath) {
    throw new Error(`'${reference}' holds no icon index.`);
  }

  return indexPath.trim();
}

async function git(args: string[]) {
  try {
    return await run('git', ['-C', packageDir, ...args], { maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    throw new Error(
      `git ${args.join(' ')} failed in '${packageDir}': ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function isFile(candidate: string): Promise<boolean> {
  try {
    return (await fs.stat(candidate)).isFile();
  } catch {
    return false;
  }
}
