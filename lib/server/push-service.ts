import { makePushSubscriptionId } from "@/lib/server/providers/push-subscription-repository";
import type {
  PushSubscriptionRecord,
  PushSubscriptionRepository
} from "@/lib/server/providers/web-push-notification-provider";

export function getVapidPublicKeyResponse(publicKey: string | undefined) {
  const normalized = publicKey?.trim();

  return {
    configured: Boolean(normalized),
    publicKey: normalized || null
  };
}

export async function registerPushSubscription(
  input: unknown,
  repository: Pick<PushSubscriptionRepository, "upsert">,
  userId = "local-user"
) {
  const subscription = normalizePushSubscription(input, userId);

  if (!repository.upsert) {
    throw new Error("Push subscription repository does not support upsert");
  }

  await repository.upsert(subscription);

  return {
    status: "saved" as const,
    id: subscription.id
  };
}

function normalizePushSubscription(input: unknown, userId: string): PushSubscriptionRecord {
  if (
    typeof input !== "object" ||
    input === null ||
    !("endpoint" in input) ||
    typeof input.endpoint !== "string" ||
    !("keys" in input) ||
    typeof input.keys !== "object" ||
    input.keys === null ||
    !("p256dh" in input.keys) ||
    typeof input.keys.p256dh !== "string" ||
    !("auth" in input.keys) ||
    typeof input.keys.auth !== "string" ||
    !input.endpoint ||
    !input.keys.p256dh ||
    !input.keys.auth
  ) {
    throw new Error("Invalid PushSubscription");
  }

  return {
    id: makePushSubscriptionId(input.endpoint),
    userId,
    endpoint: input.endpoint,
    expirationTime:
      "expirationTime" in input && typeof input.expirationTime === "number" ? input.expirationTime : null,
    keys: {
      p256dh: input.keys.p256dh,
      auth: input.keys.auth
    },
    createdAt: new Date().toISOString()
  };
}
