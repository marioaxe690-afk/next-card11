import { NextResponse } from "next/server";
import { resolveMimoProviderConfig } from "@/lib/server/providers/mimo-ai-provider";

export const runtime = "nodejs";

export function GET() {
  const mimoConfig = resolveMimoProviderConfig();

  return NextResponse.json({
    status: "ok",
    service: "next-card-backend",
    capabilities: [
      "plan-mode",
      "import-review",
      "schedule-planner",
      "freeze-return",
      "worker-tick",
      "queue-repository-port",
      "chat-compat",
      "legacy-ai-compat",
      "proof-export",
      "schedule-action-compat",
      "web-push-provider",
      "ics-calendar-provider"
    ],
    providers: {
      push: {
        kind: "web-push",
        configured: Boolean(process.env.NEXT_CARD_PUSH_VAPID_PUBLIC_KEY && process.env.NEXT_CARD_PUSH_VAPID_PRIVATE_KEY)
      },
      calendar: {
        kind: "ics",
        configured: true
      },
      ai: {
        kind: mimoConfig ? "mimo-openai-compatible" : "local-fallback",
        configured: Boolean(mimoConfig),
        plannerModel: mimoConfig?.plannerModel ?? process.env.MIMO_PLANNER_MODEL ?? "mimo-v2.5-pro",
        multimodalModel: mimoConfig?.multimodalModel ?? process.env.MIMO_MULTIMODAL_MODEL ?? "mimo-v2.5",
        strict: mimoConfig?.strict ?? false
      },
      chat: {
        kind: process.env.NEXT_CARD_CHAT_PROVIDER === "deepseek" ? "deepseek-compatible" : "mimo-plan-mode-compatible",
        configured: Boolean(mimoConfig || process.env.DEEPSEEK_API_KEY),
        preferredProvider: process.env.NEXT_CARD_CHAT_PROVIDER === "deepseek" ? "deepseek" : "mimo",
        deepSeekConfigured: Boolean(process.env.DEEPSEEK_API_KEY)
      }
    }
  });
}
