import type { AIReplyPayload, ChatMessage, SourceType } from "@/lib/types";

export type ChatApiResponse = {
  payload: AIReplyPayload;
  fallback: boolean;
  provider?: "mimo" | "deepseek" | "local";
};

export type ChatApiContext = {
  contextNote?: string;
  sourceType?: SourceType;
  parsedText?: string;
};

export async function callChatApi(
  messages: ChatMessage[],
  contextOrNote?: string | ChatApiContext
): Promise<ChatApiResponse> {
  const ctx: ChatApiContext = typeof contextOrNote === "string" ? { contextNote: contextOrNote } : contextOrNote ?? {};

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      contextNote: ctx.contextNote,
      sourceType: ctx.sourceType,
      parsedText: ctx.parsedText
    })
  });

  if (!response.ok) {
    throw new Error(`chat api returned ${response.status}`);
  }

  return (await response.json()) as ChatApiResponse;
}
