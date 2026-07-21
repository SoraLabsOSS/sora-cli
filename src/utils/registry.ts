import { DEFAULT_REGISTRY, REGISTRIES } from "@/constants.js";
import type { Registry, RegistryItem } from "@/types.js";

const HTTP_URL = /^https?:\/\//;
const TRAILING_SLASH = /\/$/;

/**
 * `--registry` accepts either a known Sora Labs product key ("ui") or a
 * full URL of any shadcn-compatible registry — the fetch/validation/alias-
 * rewrite/path-resolution logic here doesn't assume anything Sora-specific,
 * so pointing it at a third-party registry (or a private/internal one)
 * works the same way.
 */
function resolveRegistryUrl(registry?: string): string {
  const envOverride = process.env.SORA_REGISTRY_URL;
  if (envOverride) {
    return envOverride;
  }

  if (registry && HTTP_URL.test(registry)) {
    return registry.replace(TRAILING_SLASH, "");
  }

  const key = registry ?? DEFAULT_REGISTRY;
  const url = REGISTRIES[key];

  if (!url) {
    const available = Object.keys(REGISTRIES).join(", ");
    throw new Error(
      `Unknown registry "${key}". Available: ${available}, or pass a full registry URL.`
    );
  }

  return url;
}

async function tryExtractErrorDetail(
  response: Response
): Promise<string | null> {
  try {
    const body = (await response.clone().json()) as {
      detail?: string;
      error?: string;
      message?: string;
    };
    return body.message ?? body.error ?? body.detail ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetches and parses JSON from a registry URL, turning the ways this can
 * fail (network down, non-2xx response, invalid JSON, unexpected shape)
 * into a message that says what happened and what to do about it, rather
 * than a raw `fetch failed` or a crash deep inside tree resolution.
 */
async function fetchJson<T>(
  url: string,
  notFoundMessage: string,
  validate: (data: unknown) => asserts data is T
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    const cause = (
      err as { cause?: { code?: string; message?: string } } | undefined
    )?.cause;
    const reason = cause?.code ?? cause?.message ?? (err as Error).message;
    throw new Error(
      `Could not reach ${url} (${reason}). Check your network connection and try again.`,
      { cause: err }
    );
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(notFoundMessage);
    }
    const detail = await tryExtractErrorDetail(response);
    throw new Error(
      `Registry request to ${url} failed: ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error(`Registry at ${url} returned invalid JSON.`, {
      cause: err,
    });
  }

  validate(data);
  return data;
}

function assertRegistry(data: unknown): asserts data is Registry {
  const candidate = data as Partial<Registry> | null;
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof candidate.name !== "string" ||
    !Array.isArray(candidate.items)
  ) {
    throw new Error(
      'Malformed registry response: expected an object with "name" and an "items" array.'
    );
  }
}

function assertRegistryItem(data: unknown): asserts data is RegistryItem {
  const candidate = data as Partial<RegistryItem> | null;
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof candidate.name !== "string" ||
    !Array.isArray(candidate.files)
  ) {
    throw new Error(
      'Malformed component response: expected an object with "name" and a "files" array.'
    );
  }
}

export async function fetchRegistry(registry?: string): Promise<Registry> {
  const baseUrl = resolveRegistryUrl(registry);
  return await fetchJson(
    `${baseUrl}/r/registry.json`,
    `Registry not found at ${baseUrl}. Check the registry URL is correct.`,
    assertRegistry
  );
}

export async function fetchComponent(
  name: string,
  registry?: string
): Promise<RegistryItem> {
  const baseUrl = resolveRegistryUrl(registry);
  return await fetchJson(
    `${baseUrl}/r/${name}.json`,
    `Component "${name}" not found. Run "sora list" to see available components.`,
    assertRegistryItem
  );
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
