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
      const match = Object.entries(paths).find(([key]) =>
        key.startsWith("@/")
      );
      if (match) {
        const alias = match[0].replace(/\/\*$/, "");
        const target = match[1]?.[0]?.replace(/\/\*$/, "").replace(/^\.\//, "") ?? "";
        const srcDir = target === "src" || target.startsWith("src/") ? "src" : "";
        return { alias, srcDir };
      }
    } catch {
      // malformed config, fall through to default
    }
  }
  return { alias: "@", srcDir: existsSync("src") ? "src" : "" };
}

export function detectConfig(): ProjectConfig {
  const { alias, srcDir } = detectAlias();
  return {
    packageManager: detectPackageManager(),
    componentPath: srcDir ? `${srcDir}/${DEFAULT_COMPONENT_PATH}` : DEFAULT_COMPONENT_PATH,
    alias,
    srcDir,
  };
}
