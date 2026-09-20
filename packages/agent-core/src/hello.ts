import { client, MODEL } from "./model";

const response = await client.messages.create({
  model: MODEL,
  max_tokens: 1024,
  messages: [{ role: "user", content: "Say hello in one short sentence." }],
});

for (const block of response.content) {
  if (block.type === "text") console.log(block.text);
}
console.log(`\nstop_reason=${response.stop_reason} usage=${JSON.stringify(response.usage)}`);
