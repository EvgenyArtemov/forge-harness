import type Anthropic from "@anthropic-ai/sdk";
import { client, MODEL } from "./model";
import { executeTool, tools, type ToolContext } from "./tools";

export interface RunOptions extends ToolContext {}

export async function runAgent(prompt: string, opts: RunOptions): Promise<void> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];

  void client; void MODEL; void tools; void executeTool; void messages;
  throw new Error("runAgent: not implemented yet — this is exercise 0.4");
}
