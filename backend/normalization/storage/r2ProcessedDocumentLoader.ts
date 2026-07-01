export type ProcessedInputDocument = {
  id: string;
  version: "process_input.v1";
  title: string;
  sourceType: "paste" | "txt" | "pdf";
  originalText: string;
  canonicalText: string;
  metadata: {
    characterCount: number;
    wordCount: number;
    paragraphCount: number;
    pageCount?: number;
    createdAt: string;
  };
};

export type R2ObjectBodyLike = {
  text(): Promise<string>;
};

export type R2BucketLike = {
  get(key: string): Promise<R2ObjectBodyLike | null>;
};

export function getProcessedDocumentKey(documentId: string): string {
  return `documents/${documentId}/processed.json`;
}

export class R2ProcessedDocumentLoader {
  constructor(private readonly bucket: R2BucketLike) {}

  async load(documentId: string): Promise<ProcessedInputDocument | null> {
    const object = await this.bucket.get(getProcessedDocumentKey(documentId));
    if (object === null) return null;
    return JSON.parse(await object.text()) as ProcessedInputDocument;
  }
}
