# @soralabsoss/sora-cli

[![Socket Badge](https://badge.socket.dev/npm/package/@soralabsoss/sora-cli/0.1.7)](https://socket.dev/npm/package/@soralabsoss/sora-cli/overview/0.1.7)

CLI to install [Sora UI](https://ui.soralabs.io.vn) components — and, over time, components from other Sora Labs products (Sora Studio, Sora Lattice) — into your project.

## Usage

```bash
npx @soralabsoss/sora-cli add text-effect

# multiple components
npx @soralabsoss/sora-cli add text-effect draw-underline-link

# interactive picker
npx @soralabsoss/sora-cli add

# list available components
npx @soralabsoss/sora-cli list
```

### Options

```bash
npx @soralabsoss/sora-cli add text-effect --path src/components/ui
npx @soralabsoss/sora-cli add text-effect --force
npx @soralabsoss/sora-cli add text-effect --registry ui   # default; other products register here later
npx @soralabsoss/sora-cli add text-effect --yes           # skip the install confirmation, for scripts/CI
npx @soralabsoss/sora-cli add text-effect --dry-run       # preview what would change, write nothing
npx @soralabsoss/sora-cli add text-effect --silent        # only print summary lines, not per-file output
npx @soralabsoss/sora-cli add text-effect --view          # print file contents instead of writing them
npx @soralabsoss/sora-cli --version
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
