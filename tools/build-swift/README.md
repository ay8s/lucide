# build-swift

A internal used package to build the Swift package.

It turns a released `lucide-static` font into a Swift package that exposes every
icon as a named constant, so an app references `LucideIcon.circleCheck` instead
of the character `"\u{E5A8}"`.

```sh
pnpm build:swift
```

Writes the package to `lucide-swift/` in the repository root.

## Options

| Option        | Default                                   | What it does                                                              |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `--version`   | `latest`                                  | The `lucide-static` release to take the font and its code points from.     |
| `--font-dir`  | –                                         | Use a locally built font (`pnpm build:font` writes one to `lucide-font/`). |
| `--icons-dir` | `icons/`                                  | Where to read the icon metadata (aliases, deprecations) from.              |
| `--out`       | `lucide-swift/`                           | Where to write the package.                                               |
| `--module`    | `LucideIcons`                             | The Swift module the package exposes, which names its source directories.  |
| `--repo-url`  | `https://github.com/your-org/<module>.git` | The URL the generated README tells people to depend on.                   |
| `--check`     | off                                       | Report what would change and exit non-zero, without writing. For CI.      |

`.gitignore` is only written when the target has none, so a repository keeps its
own.

```sh
# Write the package to a checkout of the repository it is published from.
pnpm build:swift \
  --module=LucideSwift \
  --repo-url=https://github.com/bufferapp/LucideSwift.git \
  --out=../LucideSwift

# Generate against a font built from this checkout, including unreleased icons
# once `pnpm build:font` has allocated their code points.
pnpm build:font && pnpm build:swift --font-dir=./lucide-font --version=next

# Fail if the committed package is out of date.
pnpm build:swift --check --module=LucideSwift --out=../LucideSwift
```

## How it works

`codepoints.json` maps every icon name Lucide has ever released to a code point.
Code points are allocated once and never reused, so the mapping only ever grows
and an existing icon never moves to a different glyph. What does change is the
set of names: icons get added, renamed and removed.

The generator reads three things and reconciles them:

1. **`lucide.ttf`** — its `cmap` says which code points actually have a glyph.
   This is what separates a name that renders from a name that would render as
   blank space.
2. **`codepoints.json`** — every name and its code point, including the names of
   icons that have since been removed.
3. **`icons/*.json`** — which names are canonical, which are aliases, and which
   aliases are deprecated.

Each name then lands in one of four groups:

| Group          | Generated as                                                                            |
| -------------- | --------------------------------------------------------------------------------------- |
| icon           | `LucideIcon.circleCheck`                                                                |
| alias          | a constant resolving to its canonical icon, deprecated with a `renamed:` fix-it          |
| removed        | a deprecated constant explaining that the font has no glyph for it any more              |
| unreleased     | nothing, it is only reported. No released font has a code point for it yet               |

An alias whose Swift name is the same as its icon's (`arrow-down-01` and
`arrow-down-0-1` both camel case to `arrowDown01`) is skipped and reported.

## Layout

```
src/
  main.ts               the CLI: read the font, generate, write or check
  fontAssets.ts         download a released font, or read a local one
  parseSfnt.ts          the font's names and which code points have a glyph
  readIconMetadata.ts   icons/*.json
  collectIcons.ts       icons, aliases, removed and unreleased names
  generateSwift.ts      the Swift sources and the runtime lookup table
  writePackage.ts       template expansion, writing and `--check`
template/               the hand-written part of the Swift package, with
                        {{MODULE}} in paths and sources
```

The generated package's tests check every constant against the bundled font, so
a font update that drops a glyph fails `swift test` instead of shipping an empty
box.

```sh
pnpm test:swift   # the generator's tests
cd lucide-swift && swift test   # the generated package's tests
```
