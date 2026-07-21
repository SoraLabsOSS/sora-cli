import { done, header } from "../utils/colors.js";
import { fetchRegistry } from "../utils/registry.js";

interface ListOptions {
  json?: boolean;
  registry?: string;
}

export async function list(options: ListOptions): Promise<void> {
  const data = await fetchRegistry(options.registry);
  const components = data.items.filter(
    (item) => item.type === "registry:ui" && !item.name.startsWith("demo-")
  );

  if (options.json) {
    console.log(JSON.stringify(components, null, 2));
    return;
  }

  header();
  done(`${components.length} components available from ${data.name}:`);
  console.log();
  for (const item of components) {
    console.log(`  ${item.name}${item.description ? ` — ${item.description}` : ""}`);
  }
}
