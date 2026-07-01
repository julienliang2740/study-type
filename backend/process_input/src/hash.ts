import { createHash } from "node:crypto";

export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function stableDocumentId(
  sourceType: string,
  title: string,
  canonicalText: string
): string {
  const hash = sha256Hex(`${sourceType}\n${title}\n${canonicalText}`);
  return `doc_${sourceType}_${hash.slice(0, 20)}`;
}

export function stableBlockId(order: number, text: string): string {
  const hash = sha256Hex(`${order}\n${text}`);
  return `block_${order}_${hash.slice(0, 16)}`;
}
