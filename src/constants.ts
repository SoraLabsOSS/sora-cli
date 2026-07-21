/**
 * Registered Sora Labs product registries. Each product exposes a
 * shadcn-compatible registry at `<url>/r/registry.json` and
 * `<url>/r/<name>.json`, built via `registry:build` in that product's repo.
 *
 * Add new products (sora-studio, sora-lattice, ...) here as they ship —
 * the CLI logic itself never needs to change.
 */
export const REGISTRIES: Record<string, string> = {
  ui: "https://ui.soralabs.io.vn",
};

export const DEFAULT_REGISTRY = "ui";

export const DEFAULT_COMPONENT_PATH = "components/sora-ui";
