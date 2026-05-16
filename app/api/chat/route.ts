import { NextRequest } from "next/server";
import { NEXT_CARD_SYSTEM_PROMPT } from "@/lib/ai-prompts";
import type { AIReplyPayload, ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRequestBody = {
  messages: ChatMessage[];
  contextNote?: string;
};

type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const FALLBACK_PAYLOAD: AIReplyPayload = {
  reply: "（AI 服务未配置或暂时不可用，先按本地默认理解继续。你也可以再说一句补充。）",
  next_phase: "thinking",
  question: null,
  plans: null,
  analysis_patch: null
};

export async function POST(request: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  if (!apiKey) {
    return jsonResponse({ payload: FALLBACK_PAYLOAD, fallback: true }, 200);
  }

  const conversationMessages = toDeepSeekMessages(body.messages, body.contextNote);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: conversationMessages,
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1200
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[deepseek] non-ok response", response.status, errorText.slice(0, 500));
      return jsonResponse(
        {
          payload: {
            ...FALLBACK_PAYLOAD,
            reply: `（AI 服务返回了 ${response.status}，先按本地理解继续。再说一句也行。）`
          },
          fallback: true
        },
        200
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content ?? "";

    const payload = parsePayload(content);
    return jsonResponse({ payload, fallback: false }, 200);
  } catch (error) {
    console.error("[deepseek] request failed", error);
    return jsonResponse(
      {
        payload: {
          ...FALLBACK_PAYLOAD,
          reply: "（连不上 AI 服务，先按本地理解继续。再说一句也行。）"
        },
        fallback: true
      },
      200
    );
  }
}

function toDeepSeekMessages(messages: ChatMessage[], contextNote?: string): DeepSeekMessage[] {
  const out: DeepSeekMessage[] = [
    { role: "system", content: NEXT_CARD_SYSTEM_PROMPT }
  ];

  if (contextNote && contextNote.trim()) {
    out.push({ role: "system", content: contextNote.trim() });
  }

  for (const message of messages) {
    if (!message.text || !message.text.trim()) {
      continue;
    }

    out.push({
      role: message.role === "user" ? "user" : "assistant",
      content: message.text
    });
  }

  return out;
}

function parsePayload(content: string): AIReplyPayload {
  if (!content) {
    return FALLBACK_PAYLOAD;
  }

  try {
    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as Partial<AIReplyPayload>;

    const reply = typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : FALLBACK_PAYLOAD.reply;
    const phase = ["thinking", "asking", "generating", "ready"].includes(String(parsed.next_phase))
      ? (parsed.next_phase as AIReplyPayload["next_phase"])
      : "thinking";

    return {
      reply,
      next_phase: phase,
      question: parsed.question ?? null,
      plans: parsed.plans ?? null,
      analysis_patch: parsed.analysis_patch ?? null
    };
  } catch (error) {
    console.error("[deepseek] parse failed", error, content.slice(0, 500));
    return {
      ...FALLBACK_PAYLOAD,
      reply: content.slice(0, 200) || FALLBACK_PAYLOAD.reply
    };
  }
}

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
