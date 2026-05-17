import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BackendPorts } from "@/lib/server/backend-ports";
import { runBackendWorkerTick } from "@/lib/server/backend-worker";
import { createImportReview } from "@/lib/server/import-coverage";
import { createPlanModeTurn } from "@/lib/server/plan-mode-service";
import { createIcsCalendarProvider } from "@/lib/server/providers/ics-calendar-provider";
import { createMimoAiPlanner, createMimoImportParser, resolveMimoProviderConfig } from "@/lib/server/providers/mimo-ai-provider";
import { JsonFilePushSubscriptionRepository } from "@/lib/server/providers/push-subscription-repository";
import { createWebPushNotificationProvider } from "@/lib/server/providers/web-push-notification-provider";
import { JsonFileQueueRepository, MemoryQueueRepository } from "@/lib/server/queue-repository";
import { createSchedulePlan } from "@/lib/server/schedule-planner";

const localQueuePath = process.env.NEXT_CARD_QUEUE_FILE ?? join(tmpdir(), "next-card", "queue-snapshot.json");
export const localPushSubscriptionsPath =
  process.env.NEXT_CARD_PUSH_SUBSCRIPTIONS_FILE ?? join(tmpdir(), "next-card", "push-subscriptions.json");
export const localCalendarDir = process.env.NEXT_CARD_CALENDAR_DIR ?? join(tmpdir(), "next-card", "calendar");

export const pushSubscriptionRepository = new JsonFilePushSubscriptionRepository(localPushSubscriptionsPath);

export function createBackendPorts(): BackendPorts {
  const mimoConfig = resolveMimoProviderConfig();
  const queueRepository =
    process.env.NEXT_CARD_QUEUE_REPOSITORY === "memory"
      ? new MemoryQueueRepository()
      : new JsonFileQueueRepository(localQueuePath);

  return {
    aiPlanner: mimoConfig
      ? createMimoAiPlanner({
          config: mimoConfig,
          fallback: async (input) => createPlanModeTurn(input)
        })
      : {
          async createPlanModeTurn(input) {
            return createPlanModeTurn(input);
          }
        },
    multimodalImportParser: mimoConfig
      ? createMimoImportParser({
          config: mimoConfig,
          fallback: async (input) => createImportReview(input)
        })
      : {
          async parseImport(input) {
            return createImportReview(input);
          }
        },
    schedulePlanner: {
      async plan(input) {
        return createSchedulePlan(input);
      }
    },
    notifications: createWebPushNotificationProvider({
      config: {
        subject: process.env.NEXT_CARD_PUSH_VAPID_SUBJECT ?? "",
        publicKey: process.env.NEXT_CARD_PUSH_VAPID_PUBLIC_KEY ?? "",
        privateKey: process.env.NEXT_CARD_PUSH_VAPID_PRIVATE_KEY ?? "",
        defaultUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3001",
        ttlSeconds: Number(process.env.NEXT_CARD_PUSH_TTL_SECONDS ?? 3600)
      },
      subscriptionRepository: pushSubscriptionRepository
    }),
    calendar: createIcsCalendarProvider({
      outputDir: localCalendarDir,
      productId: process.env.NEXT_CARD_CALENDAR_PRODUCT_ID ?? "next-card/ics",
      calendarName: process.env.NEXT_CARD_CALENDAR_NAME ?? "Next Card",
      defaultDurationMinutes: Number(process.env.NEXT_CARD_CALENDAR_DEFAULT_DURATION_MINUTES ?? 25)
    }),
    queueRepository,
    worker: {
      async tick(snapshot) {
        return runBackendWorkerTick(snapshot);
      }
    }
  };
}

export const backendPorts = createBackendPorts();
