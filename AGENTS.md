# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**
- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**
- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**
- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `bun x ultracite fix` before committing to ensure compliance.

---

## CLI Design Standards

This project follows the philosophy of the [Command Line Interface Guidelines](https://clig.dev/) — CLIs are human-first interfaces, not just machine-parseable commands. When touching `src/index.ts`, `src/commands/`, or anything that changes what the CLI prints or accepts, keep it consistent with these rules:

### Output streams

- Primary/machine-readable output (e.g. `list --json`) goes to `stdout`. Errors, warnings, and status messages go to `stderr` via `error()` in `src/utils/colors.ts` (uses `console.error`, not `console.log`). Never regress this — piping `sora list --json > out.json` must not leak error text into the file.
- Human-mode output can be decorated (colors, symbols, ASCII art); `--json` output must be nothing but the JSON.

### Exit codes

- Exit `0` only when the command actually succeeded, including graceful no-ops (user cancelled a confirm prompt, picked zero components). Exit non-zero (`process.exitCode = 1`, or `process.exit(1)` in `main()`'s catch) for real failures: unknown command, unknown component, unknown registry, network errors. Commands that can fail after being invoked (like `add`) should return a `boolean`/throw rather than silently resolving successfully — see `add()` in `src/commands/add.ts`.

### Flags & help

- Every short flag needs a full-length form (`-h`/`--help`, `-v`/`--version`, `-y`/`--yes`). Don't ship a short-only flag.
- Keep `--help` concise with real usage examples (using actual registry component names, never placeholders that 404).
- Provide `--version`/`-v`. Inject it at build time (see `tsup.config.ts`'s `define: { __VERSION__ }`) rather than reading `package.json` at runtime, since the published package can be installed anywhere.
- Prefer flags over new positional arguments, except for the command's natural subject (component names for `add`, matching how `git add <files>` works).

### Interactivity & automation

- Anything that prompts (`@clack/prompts` `confirm`/`select`, the interactive component picker) must have a non-interactive escape hatch. `add` has `--yes`/`-y` to skip the install confirmation and `--force` to skip per-file overwrite prompts — keep both working, and keep them independent (don't conflate "confirm intent" with "overwrite files"). A fully automated call is `add <names> --force --yes`.
- Test non-interactive flows with `</dev/null` (no TTY) to make sure they don't hang waiting on a prompt that will never resolve in CI.

### Errors

- Error messages should say what failed and why in plain language (`Failed to resolve ${name}: ${message}`, `Unknown registry "${key}". Available: ${available}`), not raw stack traces.
- Confirm before destructive/irreversible actions (overwriting an existing file) — already the default in `writeComponent`; don't bypass it except via the explicit `--force` flag.

### Verifying changes here

Ultracite/`tsc` catch style and type issues, but not CLI-behavior regressions. After changing flag parsing, output, or exit-code logic, manually verify against a scratch project: check `--help`/`--version` output, an error path (unknown component/registry) actually exits non-zero, and a `--force --yes </dev/null` run completes without hanging.
