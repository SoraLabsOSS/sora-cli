import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DEFAULT_COMPONENT_PATH } from "../constants.js";
import type {
  ComponentAliases,
  PackageManager,
  ProjectConfig,
  RegistryItem,
} from "../types.js";

export type OverwriteChoice = "overwrite" | "skip" | "all";

const CN_UTILS_CONTENT = `import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;

/**
 * shadcn's base "utils" registry dependency (the \`cn\` helper) isn't
 * fetchable from a product registry — write it directly if the target
 * project doesn't already have it.
 */
export function ensureUtils(srcDir: string): "written" | "exists" {
  const destPath = join(process.cwd(), srcDir, "lib", "utils.ts");
  if (existsSync(destPath)) {
    return "exists";
  }
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, CN_UTILS_CONTENT, "utf8");
  return "written";
}

interface WriteResult {
  skipped: string[];
  written: string[];
}

const COMPONENT_PREFIX = `${DEFAULT_COMPONENT_PATH}/`;

const UTILS_IMPORT = /(["'])@\/lib\/utils(["'])/g;
const HOOKS_IMPORT = /(["'])@\/hooks\//g;
const COMPONENTS_IMPORT = /(["'])@\/components\//g;
const LIB_IMPORT = /(["'])@\/lib\//g;

/**
 * Registry content is authored against the "@/" import convention
 * ("@/components/...", "@/hooks/...", "@/lib/...", "@/lib/utils"). Rewrite
 * each to the project's actual configured alias for that category —
 * they don't always share one root (e.g. a workspace package can point
 * "hooks" and "lib" at different places), so this must stay per-category
 * rather than one blanket prefix swap. The `cn` helper import is matched
 * first and separately since `aliases.utils` may not just be
 * `${aliases.lib}/utils`.
 */
function rewriteAliases(content: string, aliases: ComponentAliases): string {
  return content
    .replace(UTILS_IMPORT, `$1${aliases.utils}$2`)
    .replace(HOOKS_IMPORT, `$1${aliases.hooks}/`)
    .replace(COMPONENTS_IMPORT, `$1${aliases.components}/`)
    .replace(LIB_IMPORT, `$1${aliases.lib}/`);
}

function resolveTarget(
  file: RegistryItem["files"][number],
  item: RegistryItem,
  config: ProjectConfig
): string {
  if (!file.target) {
    return `${config.componentPath}/${item.name}.tsx`;
  }
  if (file.target.startsWith(COMPONENT_PREFIX)) {
    return `${config.componentPath}/${file.target.slice(COMPONENT_PREFIX.length)}`;
  }
  if (config.srcDir) {
    return `${config.srcDir}/${file.target}`;
  }
  return file.target;
}

export async function writeComponent(
  item: RegistryItem,
  config: ProjectConfig,
  overwriteAll: boolean,
  onConflict: (filename: string) => Promise<OverwriteChoice>
): Promise<WriteResult> {
  const written: string[] = [];
  const skipped: string[] = [];
  let overwrite = overwriteAll;

  // Sequential by design: each conflict prompt depends on the previous
  // choice ("overwrite all" must apply to every file after it).
  for (const file of item.files) {
    if (!file.content) {
      continue;
    }

    const relativeTarget = resolveTarget(file, item, config);
    const destPath = join(process.cwd(), relativeTarget);
    const newContent = rewriteAliases(file.content, config.aliases);
    const fileExists = existsSync(destPath);

    if (fileExists) {
      const currentContent = readFileSync(destPath, "utf8");
      if (currentContent === newContent) {
        // Already up to date — don't nag the user about it.
        continue;
      }
    }

    if (fileExists && !overwrite) {
      // biome-ignore lint/performance/noAwaitInLoops: prompts must run one at a time, not in parallel
      const choice = await onConflict(relativeTarget);
      if (choice === "skip") {
        skipped.push(relativeTarget);
        continue;
      }
      if (choice === "all") {
        overwrite = true;
      }
    }

    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, newContent, "utf8");
    written.push(relativeTarget);
  }

  return { skipped, written };
}

const INSTALL_ARGS: Record<PackageManager, { add: string; dev: string }> = {
  bun: { add: "add", dev: "-d" },
  npm: { add: "install", dev: "-D" },
  pnpm: { add: "add", dev: "-D" },
  yarn: { add: "add", dev: "-D" },
};

/**
 * Dependency names come from the registry (remote, untrusted input) and
 * get passed straight into `spawnSync(packageManager, [add, ...deps])` —
 * reject anything that could be interpreted as a flag by the package
 * manager instead of a package name (e.g. a malicious "-–registry=…").
 */
export function assertSafeDependencies(deps: string[]): void {
  for (const dep of deps) {
    if (dep.startsWith("-")) {
      throw new Error(`Registry returned an unsafe dependency name: "${dep}"`);
    }
  }
}

export function installDependencies(
  dependencies: string[],
  devDependencies: string[],
  packageManager: PackageManager
): boolean {
  assertSafeDependencies([...dependencies, ...devDependencies]);

  const { add, dev } = INSTALL_ARGS[packageManager];

  if (dependencies.length > 0) {
    const result = spawnSync(packageManager, [add, ...dependencies], {
      shell: process.platform === "win32",
      stdio: "ignore",
    });
    if (result.status !== 0) {
      return false;
    }
  }

  if (devDependencies.length > 0) {
    const result = spawnSync(packageManager, [add, dev, ...devDependencies], {
      shell: process.platform === "win32",
      stdio: "ignore",
    });
    if (result.status !== 0) {
      return false;
    }
  }

  return true;
}
