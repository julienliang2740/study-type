import type { ProcessedInputDocument } from "./types.js";

export type PendingInputStorageRecord = {
  originalText: string;
  processedDocument: ProcessedInputDocument;
};

export type ProcessInputStorage = {
  save(record: PendingInputStorageRecord): Promise<void>;
};

export const noopProcessInputStorage: ProcessInputStorage = {
  async save(): Promise<void> {
    // Future R2 integration point. This step intentionally does not persist.
  }
};
