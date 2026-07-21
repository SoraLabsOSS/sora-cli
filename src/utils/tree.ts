import type { RegistryItem } from "../types.js";
import { bar } from "./colors.js";
import { fetchComponent } from "./registry.js";

export interface ResolvedNode {
  children: ResolvedNode[];
  item: RegistryItem;
}

/**
 * shadcn's own base registry defines a handful of well-known dependency
 * names ("utils" being the main one, for the `cn` helper) that are never
 * published as fetchable items on a product's own registry — the shadcn
 * CLI ships them from its own base templates instead. Skip resolving
 * these; `ensureUtils` in commands/add.ts covers the "utils" case.
 */
const BASE_DEPENDENCIES = new Set(["utils"]);

/**
 * registryDependencies on soralabs items are shadcn-style namespaced refs
 * ("@soralabs/accordion"), but this CLI only ever talks to one registry at
 * a time and that registry's own /r/<name>.json endpoints use flat names.
 */
function stripNamespace(name: string): string {
  return name.includes("/") ? name.slice(name.lastIndexOf("/") + 1) : name;
}

export async function resolveTree(
  name: string,
  registry?: string,
  seen: Set<string> = new Set()
): Promise<ResolvedNode> {
  const bareName = stripNamespace(name);
  const item = await fetchComponent(bareName, registry);
  seen.add(bareName);

  const children: ResolvedNode[] = [];
  // Sequential by design: `seen` must be updated between fetches so
  // shared dependencies aren't resolved (and fetched) more than once.
  for (const rawDep of item.registryDependencies ?? []) {
    const dep = stripNamespace(rawDep);
    if (seen.has(dep) || BASE_DEPENDENCIES.has(dep)) {
      continue;
    }
    // biome-ignore lint/performance/noAwaitInLoops: must stay sequential, see comment above
    children.push(await resolveTree(dep, registry, seen));
  }

  return { children, item };
}

export function flattenTree(node: ResolvedNode): RegistryItem[] {
  const result: RegistryItem[] = [];
  for (const child of node.children) {
    result.push(...flattenTree(child));
  }
  result.push(node.item);
  return result;
}

export function printTree(node: ResolvedNode, depth = 0): void {
  const prefix = depth === 0 ? "" : `${"  ".repeat(depth)}└─ `;
  bar(`${prefix}${node.item.name}`);
  for (const child of node.children) {
    printTree(child, depth + 1);
  }
}

export function collectNpmDeps(items: RegistryItem[]): {
  dependencies: string[];
  devDependencies: string[];
} {
  const dependencies = new Set<string>();
  const devDependencies = new Set<string>();

  for (const item of items) {
    for (const dep of item.dependencies ?? []) {
      dependencies.add(dep);
    }
    for (const dep of item.devDependencies ?? []) {
      devDependencies.add(dep);
    }
  }

  return {
    dependencies: [...dependencies],
    devDependencies: [...devDependencies],
  };
}
