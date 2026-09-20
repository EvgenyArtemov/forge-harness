import Anthropic from "@anthropic-ai/sdk";

// DeepSeek exposes an Anthropic-compatible Messages API, so we keep the Anthropic SDK
// and point it at DeepSeek's endpoint.
export const MODEL = "deepseek-v4-pro";

export const client = new Anthropic({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/anthropic",
});
