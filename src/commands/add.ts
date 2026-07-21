import { confirm, isCancel, select, spinner } from "@clack/prompts";
import { searchMultiselect } from "../prompts/search-multiselect.js";
import type { RegistryItem } from "../types.js";
import { active, bar, done, error, header, success } from "../utils/colors.js";
import { detectConfig } from "../utils/detect.js";
import {
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
}

export async function add(
  componentNames: string[],
  options: AddOptions
): Promise<void> {
  header();

  const config = detectConfig();
  if (options.path) {
    config.componentPath = options.path;
  }

  done(`Detected: ${config.componentPath}/ (${config.packageManager})`);
  console.log();

  let selectedComponents = componentNames;

  if (selectedComponents.length === 0) {
    const availableComponents = await getAvailableComponents(
      options.registry
    );
    const items = availableComponents.map((name) => ({
      value: name,
      label: name,
      category: "Components",
    }));

    const selected = await searchMultiselect({
      message: "Select components to install:",
      items,
    });

    if (!selected || selected.length === 0) {
      console.log();
      done("No components selected.");
      return;
    }

    selectedComponents = selected;
    done(`Selected: ${selectedComponents.join(", ")}`);
    console.log();
  }

  active("Resolving dependencies...");
  bar();

  const allComponents: RegistryItem[] = [];
  const seen = new Set<string>();

  for (const name of selectedComponents) {
    if (seen.has(name)) {
      continue;
    }

    try {
      const tree = await resolveTree(name, options.registry);
      const flat = flattenTree(tree);

      for (const item of flat) {
        if (!seen.has(item.name)) {
          seen.add(item.name);
          allComponents.push(item);
        }
      }

      printTree(tree);
    } catch (err) {
      error(`Failed to resolve ${name}: ${(err as Error).message}`);
      return;
    }
  }

  bar();

  const needsUtils = allComponents.some((item) =>
    item.registryDependencies?.includes("utils")
  );

  const { dependencies, devDependencies } = collectNpmDeps(allComponents);
  if (needsUtils) {
    for (const dep of ["clsx", "tailwind-merge"]) {
      if (!dependencies.includes(dep)) {
        dependencies.push(dep);
      }
    }
  }
  const allDeps = [...dependencies, ...devDependencies];

  const totalComponents = allComponents.length;
  const totalDeps = dependencies.length + devDependencies.length;

  const confirmMessage =
    totalDeps > 0
      ? `Install ${totalComponents} component${totalComponents > 1 ? "s" : ""} + ${totalDeps} npm package${totalDeps > 1 ? "s" : ""}?`
      : `Install ${totalComponents} component${totalComponents > 1 ? "s" : ""}?`;

  const confirmed = await confirm({ message: confirmMessage });

  if (isCancel(confirmed) || !confirmed) {
    done("Installation cancelled.");
    return;
  }

  console.log();

  if (needsUtils) {
    const result = ensureUtils();
    if (result === "written") {
      done("Written: lib/utils.ts");
    }
  }

  let overwriteAll = options.force ?? false;

  for (const item of allComponents) {
    const { written, skipped } = await writeComponent(
      item,
      config,
      overwriteAll,
      async (filename) => {
        const action = await select({
          message: `File exists: ${filename}`,
          options: [
            { value: "overwrite", label: "Overwrite" },
            { value: "skip", label: "Skip" },
            { value: "all", label: "Overwrite all" },
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

  if (dependencies.length > 0 || devDependencies.length > 0) {
    const loadingSpinner = spinner();
    loadingSpinner.start(`Installing ${allDeps.join(", ")}`);

    const installed = installDependencies(
      dependencies,
      devDependencies,
      config.packageManager
    );

    if (installed) {
      loadingSpinner.stop(`Installed: ${allDeps.join(", ")}`);
    } else {
      loadingSpinner.stop("Failed to install dependencies");
      if (dependencies.length > 0) {
        bar(`Run manually: ${config.packageManager} add ${dependencies.join(" ")}`);
      }
      if (devDependencies.length > 0) {
        const devFlag = config.packageManager === "bun" ? "-d" : "-D";
        bar(
          `Run manually: ${config.packageManager} add ${devFlag} ${devDependencies.join(" ")}`
        );
      }
    }
  }

  console.log();
  success(
    `Done! ${totalComponents} component${totalComponents > 1 ? "s" : ""} installed.`
  );
}
