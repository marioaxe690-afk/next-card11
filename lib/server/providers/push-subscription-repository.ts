import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PushSubscriptionRecord, PushSubscriptionRepository } from "@/lib/server/providers/web-push-notification-provider";

export class JsonFilePushSubscriptionRepository implements PushSubscriptionRepository {
  constructor(private readonly filePath: string) {}

  async listActive(): Promise<PushSubscriptionRecord[]> {
    return this.readAll();
  }

  async upsert(record: PushSubscriptionRecord): Promise<void> {
    const records = await this.readAll();
    const now = new Date().toISOString();
    const existingIndex = records.findIndex((item) => item.endpoint === record.endpoint || item.id === record.id);
    const nextRecord = {
      ...record,
      updatedAt: now,
      createdAt: record.createdAt || now
    };

    if (existingIndex >= 0) {
      records[existingIndex] = {
        ...records[existingIndex],
        ...nextRecord,
        id: records[existingIndex].id
      };
    } else {
      records.push(nextRecord);
    }

    await this.writeAll(records);
  }

  async remove(id: string): Promise<void> {
    const records = await this.readAll();
    await this.writeAll(records.filter((record) => record.id !== id));
  }

  private async readAll(): Promise<PushSubscriptionRecord[]> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as PushSubscriptionRecord[];
    } catch (error) {
      if (isMissingFile(error)) {
        return [];
      }

      throw error;
    }
  }

  private async writeAll(records: PushSubscriptionRecord[]) {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }
}

export function makePushSubscriptionId(endpoint: string) {
  let hash = 0;
  for (let index = 0; index < endpoint.length; index += 1) {
    hash = (hash * 31 + endpoint.charCodeAt(index)) >>> 0;
  }

  return `push-sub-${hash.toString(16)}`;
}

function isMissingFile(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
