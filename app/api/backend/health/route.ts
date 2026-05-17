import { NextResponse } from "next/server";
import { resolveMimoProviderConfig } from "@/lib/server/providers/mimo-ai-provider";

export const runtime = "nodejs";

// Health endpoint:
// - In production we never reveal model names, provider kinds, or env values.
// - The verbose payload is gated behind ?debug=1 + a server-side debug header.
//   Without it we expose only a minimal liveness shape.
export function GET(request: Request) {
  const url = new URL(request.url);
  const debugRequested = url.searchParams.get("debug") === "1";
  const debugTokenMatches =
    typeof process.env.NEXT_CARD_HEALTH_DEBUG_TOKEN === "string" &&
    process.env.NEXT_CARD_HEALTH_DEBUG_TOKEN.length > 0 &&
    request.headers.get("x-health-debug") === process.env.NEXT_CARD_HEALTH_DEBUG_TOKEN;
  const isDev = process.env.NODE_ENV !== "production";
  const allowVerbose = (debugRequested && debugTokenMatches) || isDev;

  const mimoConfig = resolveMimoProviderConfig();
  const aiConfigured = Boolean(mimoConfig || process.env.DEEPSEEK_API_KEY);
  const pushConfigured = Boolean(
    process.env.NEXT_CARD_PUSH_VAPID_PUBLIC_KEY && process.env.NEXT_CARD_PUSH_VAPID_PRIVATE_KEY
  );

  if (!allowVerbose) {
    return NextResponse.json({
      status: "ok",
      service: "next-card-backend",
      // Capability list is part of the public contract (frontends rely on it).
      capabilities: [
        "plan-mode",
        "import-review",
        "schedule-planner",
        "freeze-return",
        "worker-tick",
        "proof-export"
      ],
      providers: {
        push: { configured: pushConfigured },
        calendar: { configured: true },
        ai: { configured: aiConfigured }
      }
    });
  }

  // Verbose response (dev or debug-token authenticated).
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
      push: { kind: "web-push", configured: pushConfigured },
      calendar: { kind: "ics", configured: true },
      ai: {
        kind: mimoConfig ? "mimo-openai-compatible" : "local-fallback",
        configured: Boolean(mimoConfig),
        plannerModel: mimoConfig?.plannerModel ?? process.env.MIMO_PLANNER_MODEL ?? "mimo-v2.5-pro",
        multimodalModel: mimoConfig?.multimodalModel ?? process.env.MIMO_MULTIMODAL_MODEL ?? "mimo-v2.5",
        strict: mimoConfig?.strict ?? false
      },
      chat: {
        kind: process.env.NEXT_CARD_CHAT_PROVIDER === "deepseek" ? "deepseek-compatible" : "mimo-plan-mode-compatible",
        configured: aiConfigured,
        preferredProvider: process.env.NEXT_CARD_CHAT_PROVIDER === "deepseek" ? "deepseek" : "mimo",
        deepSeekConfigured: Boolean(process.env.DEEPSEEK_API_KEY)
      }
    }
  });
}
