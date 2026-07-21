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

export interface ProjectConfig {
  alias: string;
  componentPath: string;
  packageManager: PackageManager;
  srcDir: string;
}
