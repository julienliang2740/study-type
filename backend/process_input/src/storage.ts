import type {
  ProcessedInputDocument,
  ProcessedInputSourceType,
  StoredDocumentKeys,
  StoredProcessedInputResponse
} from "./types.js";

type R2PutOptions = {
  httpMetadata?: {
    contentType?: string;
  };
};

export type R2ObjectBodyLike = {
  text(): Promise<string>;
};

export type R2BucketLike = {
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView,
    options?: R2PutOptions
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBodyLike | null>;
};

export type SourceObjectForStorage = {
  bytes: Uint8Array;
  contentType: string;
};

export type StoredProcessedDocument = {
  document: ProcessedInputDocument;
  storage: StoredDocumentKeys;
};

export type ProcessInputStorage = {
  saveProcessedDocument(
    document: ProcessedInputDocument,
    source: SourceObjectForStorage
  ): Promise<StoredProcessedDocument>;
  getProcessedDocument(documentId: string): Promise<ProcessedInputDocument | null>;
};

function getOriginalFileName(sourceType: ProcessedInputSourceType): string {
  return sourceType === "pdf" ? "original.pdf" : "original.txt";
}

export function getDocumentStorageKeys(
  documentId: string,
  sourceType: ProcessedInputSourceType = "paste"
): StoredDocumentKeys {
  return {
    originalKey: `documents/${documentId}/source/${getOriginalFileName(sourceType)}`,
    processedKey: getProcessedDocumentKey(documentId)
  };
}

export function getProcessedDocumentKey(documentId: string): string {
  return `documents/${documentId}/processed.json`;
}

export function createStoredDocumentResponse({
  document,
  storage
}: StoredProcessedDocument): StoredProcessedInputResponse {
  return {
    documentId: document.id,
    status: "processed",
    title: document.title,
    sourceType: document.sourceType,
    source: document.source,
    metadata: document.metadata,
    storage
  };
}

export class MemoryProcessInputStorage implements ProcessInputStorage {
  private readonly documents = new Map<string, ProcessedInputDocument>();

  async saveProcessedDocument(
    document: ProcessedInputDocument,
    _source: SourceObjectForStorage
  ): Promise<StoredProcessedDocument> {
    this.documents.set(document.id, document);
    return {
      document,
      storage: getDocumentStorageKeys(document.id, document.sourceType)
    };
  }

  async getProcessedDocument(
    documentId: string
  ): Promise<ProcessedInputDocument | null> {
    return this.documents.get(documentId) ?? null;
  }
}

export class R2ProcessInputStorage implements ProcessInputStorage {
  constructor(private readonly bucket: R2BucketLike) {}

  async saveProcessedDocument(
    document: ProcessedInputDocument,
    source: SourceObjectForStorage
  ): Promise<StoredProcessedDocument> {
    const storage = getDocumentStorageKeys(document.id, document.sourceType);

    await this.bucket.put(storage.originalKey, source.bytes, {
      httpMetadata: {
        contentType: source.contentType
      }
    });

    await this.bucket.put(storage.processedKey, JSON.stringify(document, null, 2), {
      httpMetadata: {
        contentType: "application/json; charset=utf-8"
      }
    });

    return {
      document,
      storage
    };
  }

  async getProcessedDocument(
    documentId: string
  ): Promise<ProcessedInputDocument | null> {
    const object = await this.bucket.get(getProcessedDocumentKey(documentId));
    if (object === null) return null;
    return JSON.parse(await object.text()) as ProcessedInputDocument;
  }
}

export const memoryProcessInputStorage = new MemoryProcessInputStorage();
