import { createInterface } from "node:readline/promises";
import path from "node:path";
import { runAgent } from "@forge/agent-core";

// Usage: pnpm cli [--cwd <dir>]
const cwdFlag = process.argv.indexOf("--cwd");
const workspace = path.resolve(cwdFlag >= 0 ? process.argv[cwdFlag + 1] ?? "." : ".");

const rl = createInterface({ input: process.stdin, output: process.stdout });
console.log(`forge · workspace: ${workspace} · Ctrl+D to exit\n`);
process.stdout.write("> ");

for await (const line of rl) {
  const prompt = line.trim();
  if (prompt) {
    try {
      await runAgent(prompt, { workspace });
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
    }
  }
  process.stdout.write("\n> ");
}
