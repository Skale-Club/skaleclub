import Anthropic from "@anthropic-ai/sdk";

let anthropicClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY must be set to use the Anthropic API"
      );
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}
