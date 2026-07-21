import {
  confirm,
  isCancel,
  note,
  outro,
  select,
  spinner,
} from "@clack/prompts";
import { searchMultiselect } from "../prompts/search-multiselect.js";
import type { PackageManager, ProjectConfig, RegistryItem } from "../types.js";
import { bar, done, error, header } from "../utils/colors.js";
import { detectConfig, getInstalledDependencyNames } from "../utils/detect.js";
import {
  assertSafeDependencies,
  ensureUtils,
  installDependencies,
  writeComponent,
} from "../utils/install.js";
import { getAvailableComponents } from "../utils/registry.js";
import {
  collectNpmDeps,
  flattenTree,
  printTree,
  resolveTree,
} from "../utils/tree.js";

interface AddOptions {
  force?: boolean;
  path?: string;
  registry?: string;
  yes?: boolean;
}

async function pickComponents(registry?: string): Promise<string[] | null> {
  const loadingSpinner = spinner();
  loadingSpinner.start("Fetching available components...");
  let availableComponents: string[];
  try {
    availableComponents = await getAvailableComponents(registry);
  } catch (err) {
    loadingSpinner.stop("Failed to fetch available components", 1);
    throw err;
  }
  loadingSpinner.stop("Fetched available components");

  const items = availableComponents.map((name) => ({
    category: "Components",
    label: name,
    value: name,
  }));

  const selected = await searchMultiselect({
    items,
    message: "Select components to install:",
  });

  if (!selected || selected.length === 0) {
    console.log();
    done("No components selected.");
    return null;
  }

  done(`Selected: ${selected.join(", ")}`);
  console.log();
  return selected;
}

async function resolveComponents(
  names: string[],
  registry?: string
): Promise<RegistryItem[] | null> {
  const loadingSpinner = spinner();
  loadingSpinner.start("Resolving dependencies...");

  const allComponents: RegistryItem[] = [];
  const seen = new Set<string>();
  const trees: Parameters<typeof printTree>[0][] = [];

  // Sequential by design: `seen` must be updated between fetches so
  // shared dependencies across the requested components aren't
  // resolved (and printed) more than once.
  for (const name of names) {
    if (seen.has(name)) {
      continue;
    }

    try {
      loadingSpinner.message(`Resolving ${name}...`);
      // biome-ignore lint/performance/noAwaitInLoops: see comment above
      const tree = await resolveTree(name, registry);
      const flat = flattenTree(tree);

      for (const item of flat) {
        if (!seen.has(item.name)) {
          seen.add(item.name);
          allComponents.push(item);
        }
      }

      trees.push(tree);
    } catch (err) {
      loadingSpinner.stop(`Failed to resolve ${name}`, 1);
      error((err as Error).message);
      return null;
    }
  }

  loadingSpinner.stop("Resolved dependencies");
  bar();
  for (const tree of trees) {
    printTree(tree);
  }
  bar();
  return allComponents;
}

interface ConfirmedInstall {
  dependencies: string[];
  devDependencies: string[];
  needsUtils: boolean;
}

async function collectDepsAndConfirm(
  allComponents: RegistryItem[],
  skipConfirm: boolean
): Promise<ConfirmedInstall | null> {
  const needsUtils = allComponents.some((item) =>
    item.registryDependencies?.includes("utils")
  );

  const collected = collectNpmDeps(allComponents);
  if (needsUtils) {
    for (const dep of ["clsx", "tailwind-merge"]) {
      if (!collected.dependencies.includes(dep)) {
        collected.dependencies.push(dep);
      }
    }
  }
  assertSafeDependencies([
    ...collected.dependencies,
    ...collected.devDependencies,
  ]);

  const alreadyInstalled = getInstalledDependencyNames();
  const dependencies = collected.dependencies.filter(
    (dep) => !alreadyInstalled.has(dep)
  );
  const devDependencies = collected.devDependencies.filter(
    (dep) => !alreadyInstalled.has(dep)
  );

  if (!skipConfirm) {
    const confirmed = await confirm({
      message: buildConfirmMessage(
        allComponents.length,
        dependencies.length + devDependencies.length
      ),
    });

    if (isCancel(confirmed) || !confirmed) {
      done("Installation cancelled.");
      return null;
    }
  }

  return { dependencies, devDependencies, needsUtils };
}

function buildConfirmMessage(
  totalComponents: number,
  totalDeps: number
): string {
  const componentLabel = `${totalComponents} component${totalComponents > 1 ? "s" : ""}`;
  return totalDeps > 0
    ? `Install ${componentLabel} + ${totalDeps} npm package${totalDeps > 1 ? "s" : ""}?`
    : `Install ${componentLabel}?`;
}

async function writeComponents(
  allComponents: RegistryItem[],
  config: ProjectConfig,
  force: boolean
): Promise<void> {
  let overwriteAll = force;

  // Sequential by design: writeComponent's own conflict prompts depend
  // on `overwriteAll`, which a prior file's "overwrite all" choice can flip.
  for (const item of allComponents) {
    // biome-ignore lint/performance/noAwaitInLoops: see comment above
    const { written, skipped } = await writeComponent(
      item,
      config,
      overwriteAll,
      async (filename) => {
        const action = await select({
          message: `File exists: ${filename}`,
          options: [
            { label: "Overwrite", value: "overwrite" },
            { label: "Skip", value: "skip" },
            { label: "Overwrite all", value: "all" },
          ],
        });

        if (isCancel(action)) {
          return "skip";
        }
        if (action === "all") {
          overwriteAll = true;
        }
        return action as "overwrite" | "skip" | "all";
      }
    );

    for (const file of written) {
      done(`Written: ${file}`);
    }
    for (const file of skipped) {
      done(`Skipped: ${file}`);
    }
  }
}

function installNpmDependencies(
  dependencies: string[],
  devDependencies: string[],
  packageManager: PackageManager
): void {
  if (dependencies.length === 0 && devDependencies.length === 0) {
    return;
  }

  const allDeps = [...dependencies, ...devDependencies];
  const loadingSpinner = spinner();
  loadingSpinner.start(`Installing ${allDeps.join(", ")}`);

  const installed = installDependencies(
    dependencies,
    devDependencies,
    packageManager
  );

  if (installed) {
    loadingSpinner.stop(`Installed: ${allDeps.join(", ")}`);
    return;
  }

  loadingSpinner.stop("Failed to install dependencies", 1);

  const manualCommands: string[] = [];
  if (dependencies.length > 0) {
    manualCommands.push(`${packageManager} add ${dependencies.join(" ")}`);
  }
  if (devDependencies.length > 0) {
    const devFlag = packageManager === "bun" ? "-d" : "-D";
    manualCommands.push(
      `${packageManager} add ${devFlag} ${devDependencies.join(" ")}`
    );
  }
  note(manualCommands.join("\n"), "Run manually");
}

/**
 * Returns whether the command succeeded. "No components selected" and
 * "installation cancelled" are graceful no-ops (exit 0); a resolution
 * failure (unknown component, unknown registry, network error) is a
 * real failure the caller should exit non-zero for.
 */
export async function add(
  componentNames: string[],
  options: AddOptions
): Promise<boolean> {
  header();

  const config = detectConfig();
  if (options.path) {
    config.componentPath = options.path;
  }

  done(`Detected: ${config.componentPath}/ (${config.packageManager})`);
  console.log();

  let selectedComponents = componentNames;
  if (selectedComponents.length === 0) {
    const picked = await pickComponents(options.registry);
    if (!picked) {
      return true;
    }
    selectedComponents = picked;
  }

  const allComponents = await resolveComponents(
    selectedComponents,
    options.registry
  );
  if (!allComponents) {
    return false;
  }

  const confirmResult = await collectDepsAndConfirm(
    allComponents,
    options.yes ?? false
  );
  if (!confirmResult) {
    return true;
  }
  const { dependencies, devDependencies, needsUtils } = confirmResult;

  console.log();

  if (needsUtils) {
    const result = ensureUtils(config.srcDir);
    if (result === "written") {
      done(`Written: ${config.srcDir ? `${config.srcDir}/` : ""}lib/utils.ts`);
    }
  }

  await writeComponents(allComponents, config, options.force ?? false);
  installNpmDependencies(dependencies, devDependencies, config.packageManager);

  const totalComponents = allComponents.length;
  outro(
    `Done! ${totalComponents} component${totalComponents > 1 ? "s" : ""} installed.`
  );
  return true;
}
