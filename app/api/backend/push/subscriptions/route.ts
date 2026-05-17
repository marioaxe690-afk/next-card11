import { NextResponse } from "next/server";
import { pushSubscriptionRepository } from "@/lib/server/backend-services";
import { registerPushSubscription } from "@/lib/server/push-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  try {
    const result = await registerPushSubscription(body, pushSubscriptionRepository);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid PushSubscription" },
      { status: 400 }
    );
  }
}
