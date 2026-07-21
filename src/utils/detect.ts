import { existsSync, readFileSync } from "node:fs";
import { DEFAULT_COMPONENT_PATH } from "../constants.js";
import type { PackageManager, ProjectConfig } from "../types.js";

function detectPackageManager(): PackageManager {
  if (existsSync("bun.lock") || existsSync("bun.lockb")) {
    return "bun";
  }
  if (existsSync("pnpm-lock.yaml")) {
    return "pnpm";
  }
  if (existsSync("yarn.lock")) {
    return "yarn";
  }
  return "npm";
}

function detectAlias(): string {
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
      const match = Object.entries(paths).find(([key]) =>
        key.startsWith("@/")
      );
      if (match) {
        return match[0].replace(/\/\*$/, "");
      }
    } catch {
      // malformed config, fall through to default
    }
  }
  return "@";
}

export function detectConfig(): ProjectConfig {
  return {
    packageManager: detectPackageManager(),
    componentPath: DEFAULT_COMPONENT_PATH,
    alias: detectAlias(),
  };
}
