import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { QueueRepository } from "@/lib/server/backend-ports";
import type { BackendWorkerSnapshot, QueueAction } from "@/lib/types";

export function createEmptyWorkerSnapshot(now: string): BackendWorkerSnapshot {
  return {
    now,
    queueItems: [],
    activeQueue: [],
    timeLocks: [],
    frozenTasks: [],
    hiddenGoals: [],
    processedActionIds: []
  };
}

export class MemoryQueueRepository implements QueueRepository {
  private snapshot: BackendWorkerSnapshot | null = null;

  async readSnapshot(now: string): Promise<BackendWorkerSnapshot> {
    return this.snapshot ? { ...this.snapshot, now } : createEmptyWorkerSnapshot(now);
  }

  async writeSnapshot(snapshot: BackendWorkerSnapshot): Promise<void> {
    this.snapshot = snapshot;
  }

  async markActionsProcessed(actions: QueueAction[]): Promise<void> {
    const now = this.snapshot?.now ?? new Date().toISOString();
    const snapshot = this.snapshot ?? createEmptyWorkerSnapshot(now);
    const processedActionIds = Array.from(new Set([...snapshot.processedActionIds, ...actions.map((action) => action.id)]));

    this.snapshot = { ...snapshot, processedActionIds };
  }
}

export class JsonFileQueueRepository implements QueueRepository {
  constructor(private readonly filePath: string) {}

  async readSnapshot(now: string): Promise<BackendWorkerSnapshot> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const snapshot = JSON.parse(raw) as BackendWorkerSnapshot;

      return { ...snapshot, now };
    } catch (error) {
      if (isMissingFile(error) || error instanceof SyntaxError) {
        return createEmptyWorkerSnapshot(now);
      }

      throw error;
    }
  }

  async writeSnapshot(snapshot: BackendWorkerSnapshot): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  }

  async markActionsProcessed(actions: QueueAction[]): Promise<void> {
    const now = new Date().toISOString();
    const snapshot = await this.readSnapshot(now);
    await this.writeSnapshot({
      ...snapshot,
      processedActionIds: Array.from(new Set([...snapshot.processedActionIds, ...actions.map((action) => action.id)]))
    });
  }
}

function isMissingFile(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
