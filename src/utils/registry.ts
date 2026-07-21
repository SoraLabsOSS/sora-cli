import { DEFAULT_REGISTRY, REGISTRIES } from "../constants.js";
import type { Registry, RegistryItem } from "../types.js";

function resolveRegistryUrl(registry?: string): string {
  const envOverride = process.env.SORA_REGISTRY_URL;
  if (envOverride) {
    return envOverride;
  }

  const key = registry ?? DEFAULT_REGISTRY;
  const url = REGISTRIES[key];

  if (!url) {
    const available = Object.keys(REGISTRIES).join(", ");
    throw new Error(`Unknown registry "${key}". Available: ${available}`);
  }

  return url;
}

export async function fetchRegistry(registry?: string): Promise<Registry> {
  const baseUrl = resolveRegistryUrl(registry);
  const response = await fetch(`${baseUrl}/r/registry.json`);

  if (!response.ok) {
    throw new Error(`Failed to fetch registry: ${response.status}`);
  }

  return (await response.json()) as Registry;
}

export async function fetchComponent(
  name: string,
  registry?: string
): Promise<RegistryItem> {
  const baseUrl = resolveRegistryUrl(registry);
  const response = await fetch(`${baseUrl}/r/${name}.json`);

  if (!response.ok) {
    throw new Error(`Component "${name}" not found`);
  }

  return (await response.json()) as RegistryItem;
}

export async function getAvailableComponents(
  registry?: string
): Promise<string[]> {
  const data = await fetchRegistry(registry);
  return data.items
    .filter(
      (item) => item.type === "registry:ui" && !item.name.startsWith("demo-")
    )
    .map((item) => item.name);
}
