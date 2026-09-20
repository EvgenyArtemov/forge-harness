import { readFile } from "node:fs/promises";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";

export const tools: Anthropic.Tool[] = [
  {
    name: "read_file",
    description:
      "Read a UTF-8 text file from the workspace. Path is relative to the workspace root.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to the workspace root" },
      },
      required: ["path"],
    },
  },
];

export interface ToolContext {
  workspace: string;
}

/** Returns the string that goes back to the model as the tool_result content. */
export async function executeTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<string> {
  switch (name) {
    case "read_file": {
      const { path: p } = input as { path: string };
      return readFile(path.resolve(ctx.workspace, p), "utf8");
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
