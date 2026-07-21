export interface RegistryFile {
  path: string;
  content?: string;
  type: string;
  target?: string;
}

export interface RegistryItem {
  $schema?: string;
  name: string;
  type: string;
  title?: string;
  description?: string;
  dependencies?: string[];
  devDependencies?: string[];
  registryDependencies?: string[];
  files: RegistryFile[];
}

export interface RegistryIndexItem {
  name: string;
  type: string;
  title?: string;
  description?: string;
}

export interface Registry {
  name: string;
  homepage: string;
  items: RegistryIndexItem[];
}

export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

export interface ProjectConfig {
  packageManager: PackageManager;
  componentPath: string;
  alias: string;
}
