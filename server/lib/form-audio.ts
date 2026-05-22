import { storage } from "../storage.js";
import { getActiveAIClient, getRuntimeGroqKey, getRuntimeOpenRouterKey } from "./ai-provider.js";

export type FormTranscriptionProvider = "groq" | "openrouter";

export type FormTranscriptionSettings = {
  provider: FormTranscriptionProvider;
  model: string;
  enabled: boolean;
};

const DEFAULT_TRANSCRIPTION_SETTINGS: FormTranscriptionSettings = {
  provider: "groq",
  model: "whisper-large-v3-turbo",
  enabled: true,
};

export function parseTranscriptionModel(value?: string | null): FormTranscriptionSettings {
  if (!value) return DEFAULT_TRANSCRIPTION_SETTINGS;
  const [provider, ...rest] = value.split(":");
  const model = rest.join(":");
  if (provider === "openrouter") {
    return { provider, model: model || "openai/whisper-large-v3", enabled: true };
  }
  return { provider: "groq", model: model || "whisper-large-v3-turbo", enabled: true };
}

export function serializeTranscriptionModel(provider: FormTranscriptionProvider, model: string): string {
  return `${provider}:${model}`;
}

export async function getFormTranscriptionSettings(): Promise<FormTranscriptionSettings> {
  const row = await storage.getChatIntegration("form-transcription");
  const parsed = parseTranscriptionModel(row?.model);
  return {
    ...parsed,
    enabled: row?.enabled ?? true,
  };
}

export function decodeAudioDataUrl(audioData: string): { buffer: Buffer; format: string; mimeType: string } {
  const match = audioData.match(/^data:(audio\/[\w.+-]+);base64,(.+)$/);
  const mimeType = match?.[1] || "audio/webm";
  const base64 = match?.[2] || audioData;
  const formatFromMime = mimeType.split("/")[1]?.replace("x-", "") || "webm";
  const format = formatFromMime === "mpeg" ? "mp3" : formatFromMime;
  return {
    buffer: Buffer.from(base64, "base64"),
    format,
    mimeType,
  };
}

export async function transcribeFormAudio(args: {
  audioData: string;
  settings?: FormTranscriptionSettings;
  language?: string;
}): Promise<{ text: string; provider: FormTranscriptionProvider; model: string }> {
  const settings = args.settings || await getFormTranscriptionSettings();
  const { buffer, format, mimeType } = decodeAudioDataUrl(args.audioData);

  if (settings.provider === "openrouter") {
    const integration = await storage.getChatIntegration("openrouter");
    const apiKey = getRuntimeOpenRouterKey() || process.env.OPENROUTER_API_KEY || integration?.apiKey;
    if (!apiKey) throw new Error("OpenRouter API key is not configured");

    const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || process.env.APP_URL || "http://localhost:1000",
        "X-Title": process.env.OPENROUTER_APP_NAME || "SkaleClub",
      },
      body: JSON.stringify({
        input_audio: {
          data: buffer.toString("base64"),
          format,
        },
        model: settings.model || "openai/whisper-large-v3",
        ...(args.language ? { language: args.language } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter transcription failed (${response.status}): ${body.slice(0, 200)}`);
    }

    const json = await response.json() as { text?: string };
    const text = json.text?.trim();
    if (!text) throw new Error("OpenRouter returned an empty transcription");
    return { text, provider: "openrouter", model: settings.model };
  }

  const groqIntegration = await storage.getChatIntegration("groq");
  const apiKey = getRuntimeGroqKey() || groqIntegration?.apiKey;
  if (!apiKey) throw new Error("Groq API key is not configured");

  const Groq = (await import("groq-sdk")).default;
  const groq = new Groq({ apiKey });
  const file = new File([buffer], `form-audio-${Date.now()}.${format}`, { type: mimeType });
  const transcription = await groq.audio.transcriptions.create({
    file,
    model: settings.model || "whisper-large-v3-turbo",
    response_format: "text",
    ...(args.language ? { language: args.language } : {}),
  });
  const text = (transcription as unknown as string).trim();
  if (!text) throw new Error("Groq returned an empty transcription");
  return { text, provider: "groq", model: settings.model };
}

export async function summarizeFormTranscript(transcript: string): Promise<string | null> {
  const cleaned = transcript.trim();
  if (!cleaned) return null;

  const prompt = `Summarize this lead's spoken project request for a business owner.

Return only a concise summary in the same language as the transcript.
Capture project goals, constraints, urgency, budget hints, and next-step clues.
Do not invent facts.

Transcript:
"""${cleaned}"""`;

  try {
    const aiClient = await getActiveAIClient();
    if (!aiClient?.client) return null;
    const completion = await aiClient.client.chat.completions.create({
      model: aiClient.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 220,
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("Form transcript summary error:", error);
    return null;
  }
}
