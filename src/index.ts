import { add } from "./commands/add.js";
import { list } from "./commands/list.js";
import { error, header } from "./utils/colors.js";

declare const __VERSION__: string;

const args = process.argv.slice(2);
const [command] = args;

function printHelp(): void {
  header();
  console.log("Usage: npx @soralabsoss/sora-cli <command> [options]");
  console.log();
  console.log("Commands:");
  console.log("  add [components...]   Add components to your project");
  console.log("  list                  List available components");
  console.log();
  console.log("Options:");
  console.log("  --path <path>         Custom component install path");
  console.log(
    "  --registry <name|url> Product registry key (default: ui) or a full registry URL"
  );
  console.log(
    "  --force               Overwrite existing files without asking"
  );
  console.log(
    "  --yes, -y             Skip the install confirmation prompt (for scripts/CI)"
  );
  console.log(
    "  --dry-run             Preview changes without writing files or installing packages"
  );
  console.log(
    "  --silent, -s          Suppress per-file output, keep summary lines"
  );
  console.log(
    "  --view                Print resolved file contents instead of writing them"
  );
  console.log("  --json                Output as JSON (list command)");
  console.log("  --version, -v         Show the CLI version");
  console.log("  --help, -h            Show this help message");
  console.log();
  console.log("Examples:");
  console.log("  npx @soralabsoss/sora-cli add text-effect");
  console.log(
    "  npx @soralabsoss/sora-cli add text-effect draw-underline-link"
  );
  console.log(
    "  npx @soralabsoss/sora-cli add                         # Interactive mode"
  );
  console.log("  npx @soralabsoss/sora-cli list");
  console.log(
    "  npx @soralabsoss/sora-cli add some-item --registry https://your-registry.example.com   # any shadcn-compatible registry"
  );
}

function parseFlag(argList: string[], flag: string): string | undefined {
  const index = argList.indexOf(flag);
  if (index === -1) {
    return;
  }
  return argList[index + 1];
}

async function main(): Promise<void> {
  try {
    if (!command || command === "--help" || command === "-h") {
      printHelp();
      return;
    }

    if (command === "--version" || command === "-v") {
      console.log(__VERSION__);
      return;
    }

    if (command === "add") {
      const rest = args.slice(1);
      const path = parseFlag(rest, "--path");
      const registry = parseFlag(rest, "--registry");
      const force = rest.includes("--force") || rest.includes("-f");
      const yes = rest.includes("--yes") || rest.includes("-y");
      const dryRun = rest.includes("--dry-run");
      const silent = rest.includes("--silent") || rest.includes("-s");
      const view = rest.includes("--view");

      const componentArgs = rest.filter((arg, i) => {
        if (arg.startsWith("-")) {
          return false;
        }
        const prev = rest[i - 1];
        return prev !== "--path" && prev !== "--registry";
      });

      const ok = await add(componentArgs, {
        dryRun,
        force,
        path,
        registry,
        silent,
        view,
        yes,
      });
      if (!ok) {
        process.exitCode = 1;
      }
      return;
    }

    if (command === "list" || command === "ls") {
      const rest = args.slice(1);
      const json = rest.includes("--json");
      const registry = parseFlag(rest, "--registry");
      await list({ json, registry });
      return;
    }

    error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error(msg || "An unknown error occurred");
    process.exit(1);
  }
}

main();
