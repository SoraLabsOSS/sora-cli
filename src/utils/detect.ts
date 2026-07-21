import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DEFAULT_COMPONENT_PATH } from "@/constants.js";
import type {
  ComponentAliases,
  PackageManager,
  ProjectConfig,
} from "@/types.js";

const TRAILING_GLOB = /\/\*$/;
const LEADING_DOT_SLASH = /^\.\//;
const PACKAGE_MANAGER_PREFIX = /^([a-z]+)@/;

const LOCKFILES: [string, PackageManager][] = [
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
];

function readPackageManagerField(dir: string): PackageManager | null {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) {
    return null;
  }
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      packageManager?: string;
    };
    const match = pkg.packageManager?.match(PACKAGE_MANAGER_PREFIX);
    const name = match?.[1];
    if (
      name === "bun" ||
      name === "pnpm" ||
      name === "yarn" ||
      name === "npm"
    ) {
      return name;
    }
  } catch {
    // malformed package.json, fall through
  }
  return null;
}

/**
 * Walk up from cwd looking for a lockfile or a `packageManager` field, so
 * this resolves correctly when run from inside a workspace package whose
 * lockfile lives at the monorepo root (e.g. a Bun/pnpm/Turbo workspace).
 */
function detectPackageManager(): PackageManager {
  let dir = process.cwd();

  for (;;) {
    for (const [file, manager] of LOCKFILES) {
      if (existsSync(join(dir, file))) {
        return manager;
      }
    }

    const fromPackageJson = readPackageManagerField(dir);
    if (fromPackageJson) {
      return fromPackageJson;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return "npm";
}

function detectAlias(): { alias: string; srcDir: string } {
  for (const file of ["tsconfig.json", "jsconfig.json"]) {
    if (!existsSync(file)) {
      continue;
    }
    try {
      const raw = readFileSync(file, "utf8");
      const parsed = JSON.parse(raw) as {
        compilerOptions?: { paths?: Record<string, string[]> };
      };
      const paths = parsed.compilerOptions?.paths ?? {};
      // Take the first `<prefix>/*` mapping, whatever the prefix is — most
      // projects use "@/*", but workspace packages often use something
      // like "@workspace/ui/*". Registry content is authored against the
      // "@/" convention, so this alias is used to rewrite it on write.
      const match = Object.entries(paths).find(([key]) => key.endsWith("/*"));
      if (match) {
        const alias = match[0].replace(TRAILING_GLOB, "");
        const target =
          match[1]?.[0]
            ?.replace(TRAILING_GLOB, "")
            .replace(LEADING_DOT_SLASH, "") ?? "";
        const srcDir =
          target === "src" || target.startsWith("src/") ? "src" : "";
        return { alias, srcDir };
      }
    } catch {
      // malformed config, fall through to default
    }
  }
  return { alias: "@", srcDir: existsSync("src") ? "src" : "" };
}

/**
 * shadcn's own CLI reads per-category aliases straight from
 * `components.json` rather than guessing a single prefix — do the same
 * where it's present, since a project can point "hooks" and "lib" at
 * different roots than "components".
 */
function readComponentsJsonAliases(): Partial<ComponentAliases> | null {
  if (!existsSync("components.json")) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync("components.json", "utf8")) as {
      aliases?: Partial<ComponentAliases>;
    };
    return parsed.aliases ?? null;
  } catch {
    return null;
  }
}

/**
 * A registry item's declared dependencies shouldn't clobber a version the
 * user already pinned — read what's already there so callers can skip it.
 */
export function getInstalledDependencyNames(): Set<string> {
  if (!existsSync("package.json")) {
    return new Set();
  }
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    return new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ]);
  } catch {
    return new Set();
  }
}

export function detectConfig(): ProjectConfig {
  const { alias, srcDir } = detectAlias();
  const fromComponentsJson = readComponentsJsonAliases();

  const aliases: ComponentAliases = {
    components: fromComponentsJson?.components ?? `${alias}/components`,
    hooks: fromComponentsJson?.hooks ?? `${alias}/hooks`,
    lib: fromComponentsJson?.lib ?? `${alias}/lib`,
    utils: fromComponentsJson?.utils ?? `${alias}/lib/utils`,
  };

  return {
    aliases,
    componentPath: srcDir
      ? `${srcDir}/${DEFAULT_COMPONENT_PATH}`
      : DEFAULT_COMPONENT_PATH,
    packageManager: detectPackageManager(),
    srcDir,
  };
}
