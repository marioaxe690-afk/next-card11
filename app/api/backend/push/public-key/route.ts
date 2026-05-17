import { NextResponse } from "next/server";
import { getVapidPublicKeyResponse } from "@/lib/server/push-service";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(getVapidPublicKeyResponse(process.env.NEXT_CARD_PUSH_VAPID_PUBLIC_KEY));
}
