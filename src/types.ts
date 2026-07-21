export interface RegistryFile {
  content?: string;
  path: string;
  target?: string;
  type: string;
}

export interface RegistryItem {
  $schema?: string;
  dependencies?: string[];
  description?: string;
  devDependencies?: string[];
  files: RegistryFile[];
  name: string;
  registryDependencies?: string[];
  title?: string;
  type: string;
}

export interface RegistryIndexItem {
  description?: string;
  name: string;
  title?: string;
  type: string;
}

export interface Registry {
  homepage: string;
  items: RegistryIndexItem[];
  name: string;
}

export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

/**
 * Import alias per shadcn `components.json` category. Registry content is
 * authored against "@/components/...", "@/hooks/...", "@/lib/..." and
 * "@/lib/utils" — these are what each of those gets rewritten to on write.
 */
export interface ComponentAliases {
  components: string;
  hooks: string;
  lib: string;
  utils: string;
}

export interface ProjectConfig {
  aliases: ComponentAliases;
  componentPath: string;
  packageManager: PackageManager;
  srcDir: string;
}
