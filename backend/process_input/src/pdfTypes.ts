import type { ProcessPdfRequest } from "./types.js";

export type PdfInputRequest = ProcessPdfRequest;

export type PdfExtractedText = {
  rawText: string;
  cleanedText: string;
  pageCount: number;
};

export type PdfTextItemLike = {
  str?: string;
  hasEOL?: boolean;
};
