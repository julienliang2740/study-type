export type ProcessedInputSourceType = "paste" | "txt" | "pdf";

export type ProcessedTextBlock = {
  id: string;
  order: number;
  type: "paragraph" | "heading" | "unknown";
  text: string;
};

export type ProcessedInputDocument = {
  id: string;
  version: "process_input.v1";
  title: string;
  sourceType: ProcessedInputSourceType;
  source: {
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    sha256?: string;
  };
  originalText: string;
  canonicalText: string;
  blocks: ProcessedTextBlock[];
  metadata: {
    characterCount: number;
    wordCount: number;
    paragraphCount: number;
    pageCount?: number;
    createdAt: string;
  };
};

export type ProcessedDocumentSummary = {
  documentId: string;
  status: "processed";
  title: string;
  sourceType: ProcessedInputSourceType;
  source: ProcessedInputDocument["source"];
  metadata: ProcessedInputDocument["metadata"];
  storage: {
    originalKey: string;
    processedKey: string;
  };
};
