import pc from "picocolors";
import { SORA_CLI_BANNER } from "@/ascii-art.js";

export function header(): void {
  console.log(pc.cyan(SORA_CLI_BANNER));
  console.log(pc.dim("Sora Labs component installer"));
  console.log();
}

export function active(message: string): void {
  console.log(pc.cyan("○"), message);
}

export function done(message: string): void {
  console.log(pc.green("✓"), message);
}

export function error(message: string): void {
  console.error(pc.red("✗"), message);
}

export function bar(message?: string): void {
  console.log(pc.dim(message ? `  ${message}` : "│"));
}

export function highlight(text: string): string {
  return pc.cyan(text);
}

export function dim(text: string): string {
  return pc.dim(text);
}

export function fileHeader(path: string): void {
  console.log(pc.bold(pc.cyan(`── ${path} ──`)));
}
