# @soralabsoss/sora-cli

[![Socket Badge](https://badge.socket.dev/npm/package/@soralabsoss/sora-cli/0.2.1)](https://socket.dev/npm/package/@soralabsoss/sora-cli/overview/0.2.1)

A CLI for installing components from any [shadcn](https://ui.shadcn.com)-compatible registry into your project — defaults to [Sora UI](https://ui.soralabs.io.vn) and other Sora Labs products, but works against any registry via `--registry <url>`.

## Usage

```bash
npx @soralabsoss/sora-cli add text-effect

# multiple components
npx @soralabsoss/sora-cli add text-effect draw-underline-link

# interactive picker
npx @soralabsoss/sora-cli add

# list available components
npx @soralabsoss/sora-cli list

# compare installed components against the registry
npx @soralabsoss/sora-cli diff text-effect
```

### Options

```bash
npx @soralabsoss/sora-cli add text-effect --path src/components/ui
npx @soralabsoss/sora-cli add text-effect --force
npx @soralabsoss/sora-cli add text-effect --registry ui                          # default; other Sora Labs products register here later
npx @soralabsoss/sora-cli add some-item --registry https://any-shadcn-registry.com   # or point at any shadcn-compatible registry directly
npx @soralabsoss/sora-cli add text-effect --yes           # skip the install confirmation, for scripts/CI
npx @soralabsoss/sora-cli add text-effect --dry-run       # preview what would change, write nothing
npx @soralabsoss/sora-cli add text-effect --silent        # only print summary lines, not per-file output
npx @soralabsoss/sora-cli add text-effect --view          # print file contents instead of writing them
npx @soralabsoss/sora-cli --version
```

## How it works

The CLI fetches a shadcn-compatible registry (`<product-url>/r/registry.json`, `<product-url>/r/<name>.json`) built by that product's own `registry:build` step, resolves the dependency tree, writes files into your project, and installs npm dependencies with your detected package manager (bun/pnpm/yarn/npm).

Each Sora Labs product registers its base URL in [`src/constants.ts`](src/constants.ts) as a short `--registry` key — adding a new product only requires adding an entry there, no other logic changes. `--registry` also accepts a full URL directly, so it works against any shadcn-compatible registry, not just Sora Labs' own.

Since components are copied into your project rather than installed as a package, `sora diff` is the way to check whether the registry has changed a component since you installed it — it reports differences without writing anything; re-run `add <component> --force --yes` to apply an update.

Every command also does a quick, non-blocking check against npm for a newer published version (printed to stderr, never mixed into `--json` output). Set `SORA_NO_UPDATE_CHECK=1` to disable it, e.g. in CI.

## Development

```bash
bun install
bun run build      # bundles src/index.ts -> dist/index.js via tsup
bun run typecheck
node dist/index.js list
```
