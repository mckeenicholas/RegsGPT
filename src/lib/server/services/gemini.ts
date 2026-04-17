import { GoogleGenAI } from "@google/genai";
import { getSystemPrompt } from "./documents";

let aiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface StreamChatResult {
  stream: AsyncIterable<string>;
  getUsage: () => Promise<{ totalTokens: number }>;
}

/**
 * Stream a chat response from Gemini, given conversation history and a new user message.
 * Returns an async iterable of text chunks and a function to get total token usage after completion.
 */
export async function streamChat(
  history: ChatMessage[],
  userMessage: string,
): Promise<StreamChatResult> {
  const ai = getClient();
  const systemPrompt = await getSystemPrompt();

  // Build contents array for Gemini
  const contents = history.map((msg) => ({
    role: msg.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: msg.text }],
  }));

  // Add the new user message
  contents.push({
    role: "user" as const,
    parts: [{ text: userMessage }],
  });

  let totalTokens = 0;
  let usageResolved = false;
  let resolveUsage: (usage: { totalTokens: number }) => void;
  const usagePromise = new Promise<{ totalTokens: number }>((resolve) => {
    resolveUsage = resolve;
  });

  const response = await ai.models.generateContentStream({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.3, // Low temperature for factual accuracy
      topP: 0.9,
      maxOutputTokens: 4096,
    },
  });

  // Create an async iterable that yields text chunks
  async function* textStream(): AsyncIterable<string> {
    try {
      for await (const chunk of response) {
        const text = chunk.text;
        if (text) {
          yield text;
        }
        // Track usage from the last chunk
        if (chunk.usageMetadata) {
          totalTokens = chunk.usageMetadata.totalTokenCount || 0;
        }
      }
    } finally {
      if (!usageResolved) {
        usageResolved = true;
        resolveUsage!({ totalTokens });
      }
    }
  }

  return {
    stream: textStream(),
    getUsage: () => usagePromise,
  };
}

/**
 * Check if a user has exceeded their token cap.
 */
export function isOverTokenCap(tokensUsed: number, tokenCap: number): boolean {
  return tokensUsed >= tokenCap;
}
