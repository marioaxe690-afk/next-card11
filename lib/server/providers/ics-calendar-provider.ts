import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as ics from "ics";
import type { CalendarDeliveryResult, CalendarPort } from "@/lib/server/backend-ports";
import type { QueueAction } from "@/lib/types";

export type IcsCalendarProviderConfig = {
  outputDir: string;
  productId?: string;
  calendarName?: string;
  defaultDurationMinutes?: number;
};

export type IcsCalendarProvider = CalendarPort & {
  readonly kind: "ics";
};

export function createIcsCalendarProvider(config: IcsCalendarProviderConfig): IcsCalendarProvider {
  return {
    kind: "ics",
    async createOrUpdate(action) {
      if (!isCalendarAction(action)) {
        return {
          providerId: `ics:${action.targetId}`,
          status: "skipped"
        };
      }

      const scheduledFor = action.scheduledFor ?? action.createdAt;
      const durationMinutes = getNumberPayload(action, "durationMinutes") ?? config.defaultDurationMinutes ?? 25;
      const uid = `${action.targetId}@next-card.local`;
      const event = {
        uid,
        title: action.title,
        description: getStringPayload(action, "description") ?? action.reason,
        location: getStringPayload(action, "location"),
        start: toIcsDateArray(scheduledFor),
        duration: { minutes: durationMinutes },
        status: "CONFIRMED" as const,
        busyStatus: "BUSY" as const,
        calName: config.calendarName ?? "Next Card",
        productId: config.productId ?? "next-card/ics",
        startInputType: "utc" as const,
        startOutputType: "utc" as const,
        alarms: buildAlarms(action)
      };
      const { error, value } = ics.createEvent(event);

      if (error || !value) {
        throw error ?? new Error("Failed to generate ICS event");
      }

      await mkdir(config.outputDir, { recursive: true });
      const filePath = join(config.outputDir, `${safeFileName(action.targetId)}.ics`);
      await writeFile(filePath, value, "utf8");

      return {
        providerId: `ics:${action.targetId}`,
        status: action.kind === "update-calendar-event" ? "updated" : "created",
        filePath,
        eventUid: uid
      } satisfies CalendarDeliveryResult;
    }
  };
}

function isCalendarAction(action: QueueAction) {
  return action.kind === "create-calendar-event" || action.kind === "update-calendar-event";
}

function getStringPayload(action: QueueAction, key: string) {
  const value = action.payload?.[key];
  return typeof value === "string" ? value : undefined;
}

function getNumberPayload(action: QueueAction, key: string) {
  const value = action.payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function buildAlarms(action: QueueAction) {
  const minutes = getNumberPayload(action, "reminderMinutesBefore");
  if (!minutes || minutes <= 0) {
    return undefined;
  }

  return [
    {
      action: "display" as const,
      description: "Next Card reminder",
      trigger: { minutes, before: true }
    }
  ];
}

function toIcsDateArray(iso: string): [number, number, number, number, number] {
  const date = new Date(iso);

  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes()
  ];
}

function safeFileName(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80) || "event";
}
