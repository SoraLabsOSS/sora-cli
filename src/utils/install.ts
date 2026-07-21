import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DEFAULT_COMPONENT_PATH } from "../constants.js";
import type { PackageManager, ProjectConfig, RegistryItem } from "../types.js";

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

    if (existsSync(destPath) && !overwrite) {
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
    writeFileSync(destPath, file.content, "utf8");
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

export function installDependencies(
  dependencies: string[],
  devDependencies: string[],
  packageManager: PackageManager
): boolean {
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
