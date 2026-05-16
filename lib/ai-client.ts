import type { AIReplyPayload, ChatMessage } from "@/lib/types";

export type ChatApiResponse = {
  payload: AIReplyPayload;
  fallback: boolean;
};

export async function callChatApi(messages: ChatMessage[], contextNote?: string): Promise<ChatApiResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, contextNote })
  });

  if (!response.ok) {
    throw new Error(`chat api returned ${response.status}`);
  }

  return (await response.json()) as ChatApiResponse;
}
