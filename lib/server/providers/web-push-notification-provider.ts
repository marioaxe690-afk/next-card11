import * as webPush from "web-push";
import type { NotificationPort } from "@/lib/server/backend-ports";
import type { QueueAction } from "@/lib/types";

export type PushSubscriptionRecord = {
  id: string;
  userId?: string;
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: string;
  updatedAt?: string;
};

export type PushSubscriptionRepository = {
  listActive(): Promise<PushSubscriptionRecord[]>;
  remove(id: string): Promise<void>;
  upsert?(record: PushSubscriptionRecord): Promise<void>;
};

export type WebPushClient = {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    subscription: { endpoint: string; expirationTime?: number | null; keys: { p256dh: string; auth: string } },
    payload?: string | Buffer,
    options?: {
      TTL?: number;
      urgency?: "very-low" | "low" | "normal" | "high";
      topic?: string;
      timeout?: number;
    }
  ): Promise<{ statusCode?: number }>;
};

export type WebPushNotificationProviderConfig = {
  subject: string;
  publicKey: string;
  privateKey: string;
  defaultUrl?: string;
  ttlSeconds?: number;
  timeoutMs?: number;
};

export type WebPushNotificationProvider = NotificationPort & {
  readonly kind: "web-push";
};

export function createWebPushNotificationProvider(input: {
  config: WebPushNotificationProviderConfig;
  client?: WebPushClient;
  subscriptionRepository: PushSubscriptionRepository;
}): WebPushNotificationProvider {
  const client = input.client ?? (webPush as unknown as WebPushClient);

  return {
    kind: "web-push",
    async createOrUpdate(action) {
      if (!isReminderAction(action)) {
        return {
          providerId: `web-push:${action.targetId}`,
          status: "skipped",
          sentCount: 0,
          failedCount: 0
        };
      }

      assertVapidConfig(input.config);
      client.setVapidDetails(input.config.subject, input.config.publicKey, input.config.privateKey);

      const subscriptions = await input.subscriptionRepository.listActive();
      if (subscriptions.length === 0) {
        return {
          providerId: `web-push:${action.targetId}`,
          status: "skipped",
          sentCount: 0,
          failedCount: 0
        };
      }

      const payload = JSON.stringify(buildPayload(action, input.config.defaultUrl));
      const removedSubscriptionIds: string[] = [];
      let sentCount = 0;
      let failedCount = 0;
      let lastError: string | undefined;

      await Promise.all(
        subscriptions.map(async (subscription) => {
          try {
            await client.sendNotification(subscription, payload, {
              TTL: input.config.ttlSeconds ?? 3600,
              urgency: action.priority >= 80 ? "high" : "normal",
              topic: safeTopic(action.targetId),
              timeout: input.config.timeoutMs ?? 5000
            });
            sentCount += 1;
          } catch (error) {
            failedCount += 1;
            lastError = error instanceof Error ? error.message : "Unknown Web Push delivery error";
            if (isExpiredSubscriptionError(error)) {
              removedSubscriptionIds.push(subscription.id);
              await input.subscriptionRepository.remove(subscription.id);
            }
          }
        })
      );

      return {
        providerId: `web-push:${action.targetId}`,
        status: sentCount === 0 ? "failed" : action.kind === "update-reminder" ? "updated" : "scheduled",
        sentCount,
        failedCount,
        removedSubscriptionIds,
        error: sentCount === 0 ? lastError : undefined
      };
    }
  };
}

function isReminderAction(action: QueueAction) {
  return action.kind === "create-reminder" || action.kind === "update-reminder";
}

function assertVapidConfig(config: WebPushNotificationProviderConfig) {
  if (!config.subject || !config.publicKey || !config.privateKey) {
    throw new Error("Missing Web Push VAPID configuration");
  }

  if (!config.subject.startsWith("mailto:") && !config.subject.startsWith("https://")) {
    throw new Error("Web Push VAPID subject must start with mailto: or https://");
  }
}

function buildPayload(action: QueueAction, defaultUrl?: string) {
  const payload = action.payload ?? {};
  const body = typeof payload.body === "string" ? payload.body : action.title;
  const url = typeof payload.url === "string" ? payload.url : defaultUrl;

  return {
    title: typeof payload.title === "string" ? payload.title : "Next Card",
    body,
    tag: action.targetId,
    data: {
      actionId: action.id,
      targetId: action.targetId,
      scheduledFor: action.scheduledFor,
      reason: action.reason,
      url
    }
  };
}

function safeTopic(targetId: string) {
  return targetId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "next-card";
}

function isExpiredSubscriptionError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error.statusCode === 404 || error.statusCode === 410)
  );
}

export function generateVapidKeys() {
  return webPush.generateVAPIDKeys();
}
