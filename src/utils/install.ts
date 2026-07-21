import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
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
export function ensureUtils(): "written" | "exists" {
  const destPath = join(process.cwd(), "lib", "utils.ts");
  if (existsSync(destPath)) {
    return "exists";
  }
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, CN_UTILS_CONTENT, "utf8");
  return "written";
}

interface WriteResult {
  written: string[];
  skipped: string[];
}

export async function writeComponent(
  item: RegistryItem,
  config: ProjectConfig,
  overwriteAll: boolean,
  onConflict: (filename: string) => Promise<OverwriteChoice>
): Promise<WriteResult> {
  const written: string[] = [];
  const skipped: string[] = [];

  for (const file of item.files) {
    if (!file.content) {
      continue;
    }

    const relativeTarget = file.target ?? `${config.componentPath}/${item.name}.tsx`;
    const destPath = join(process.cwd(), relativeTarget);

    if (existsSync(destPath) && !overwriteAll) {
      const choice = await onConflict(relativeTarget);
      if (choice === "skip") {
        skipped.push(relativeTarget);
        continue;
      }
      if (choice === "all") {
        overwriteAll = true;
      }
    }

    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, file.content, "utf8");
    written.push(relativeTarget);
  }

  return { written, skipped };
}

const INSTALL_ARGS: Record<PackageManager, { add: string; dev: string }> = {
  bun: { add: "add", dev: "-d" },
  pnpm: { add: "add", dev: "-D" },
  yarn: { add: "add", dev: "-D" },
  npm: { add: "install", dev: "-D" },
};

export function installDependencies(
  dependencies: string[],
  devDependencies: string[],
  packageManager: PackageManager
): boolean {
  const { add, dev } = INSTALL_ARGS[packageManager];

  if (dependencies.length > 0) {
    const result = spawnSync(packageManager, [add, ...dependencies], {
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    if (result.status !== 0) {
      return false;
    }
  }

  if (devDependencies.length > 0) {
    const result = spawnSync(
      packageManager,
      [add, dev, ...devDependencies],
      { stdio: "ignore", shell: process.platform === "win32" }
    );
    if (result.status !== 0) {
      return false;
    }
  }

  return true;
}
