import type { RegistryItem } from "../types.js";
import { bar } from "./colors.js";
import { fetchComponent } from "./registry.js";

export interface ResolvedNode {
  item: RegistryItem;
  children: ResolvedNode[];
}

/**
 * shadcn's own base registry defines a handful of well-known dependency
 * names ("utils" being the main one, for the `cn` helper) that are never
 * published as fetchable items on a product's own registry — the shadcn
 * CLI ships them from its own base templates instead. Skip resolving
 * these; `ensureUtils` in commands/add.ts covers the "utils" case.
 */
const BASE_DEPENDENCIES = new Set(["utils"]);

export async function resolveTree(
  name: string,
  registry?: string,
  seen: Set<string> = new Set()
): Promise<ResolvedNode> {
  const item = await fetchComponent(name, registry);
  seen.add(name);

  const children: ResolvedNode[] = [];
  for (const dep of item.registryDependencies ?? []) {
    if (seen.has(dep) || BASE_DEPENDENCIES.has(dep)) {
      continue;
    }
    children.push(await resolveTree(dep, registry, seen));
  }

  return { item, children };
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
  const prefix = depth === 0 ? "" : "  ".repeat(depth) + "└─ ";
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
