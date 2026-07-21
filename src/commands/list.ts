import { spinner } from "@clack/prompts";
import { done, highlight } from "../utils/colors.js";
import { fetchRegistry } from "../utils/registry.js";

interface ListOptions {
  json?: boolean;
  registry?: string;
}

export async function list(options: ListOptions): Promise<void> {
  const loadingSpinner = options.json ? null : spinner();
  loadingSpinner?.start("Fetching registry...");
  let data: Awaited<ReturnType<typeof fetchRegistry>>;
  try {
    data = await fetchRegistry(options.registry);
  } catch (err) {
    loadingSpinner?.stop("Failed to fetch registry", 1);
    throw err;
  }
  loadingSpinner?.stop("Fetched registry");

  const components = data.items.filter(
    (item) => item.type === "registry:ui" && !item.name.startsWith("demo-")
  );

  if (options.json) {
    console.log(JSON.stringify(components, null, 2));
    return;
  }

  done(`${components.length} components available from ${data.name}:`);
  console.log();
  for (const item of components) {
    console.log(
      `  ${highlight(item.name)}${item.description ? ` — ${item.description}` : ""}`
    );
  }
}
