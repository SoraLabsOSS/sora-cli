# sora-cli

CLI to install [Sora UI](https://ui.soralabs.io.vn) components — and, over time, components from other Sora Labs products (Sora Studio, Sora Lattice) — into your project.

## Usage

```bash
npx sora-cli add rolling-text

# multiple components
npx sora-cli add rolling-text draw-underline-link

# interactive picker
npx sora-cli add

# list available components
npx sora-cli list
```

### Options

```bash
npx sora-cli add rolling-text --path src/components/ui
npx sora-cli add rolling-text --force
npx sora-cli add rolling-text --registry ui   # default; other products register here later
```

## How it works

The CLI fetches a shadcn-compatible registry (`<product-url>/r/registry.json`, `<product-url>/r/<name>.json`) built by that product's own `registry:build` step, resolves the dependency tree, writes files into your project, and installs npm dependencies with your detected package manager (bun/pnpm/yarn/npm).

Each product registers its base URL in [`src/constants.ts`](src/constants.ts) — adding a new Sora Labs product only requires adding an entry there, no other logic changes.

## Development

```bash
bun install
bun run build      # bundles src/index.ts -> dist/index.js via tsup
bun run typecheck
node dist/index.js list
```
