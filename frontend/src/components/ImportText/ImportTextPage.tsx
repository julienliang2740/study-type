import { useEffect, useState } from "react";
import {
  defaultNormalizationOptions,
  emptyNormalizedTypingText,
  normalizeDocument,
  type NormalizationOptions,
  type NormalizedTypingText
} from "../../services/normalizationClient";
import {
  MAX_UPLOAD_BYTES,
  processImportFile,
  processPastedText,
  type ProcessedDocumentSummary
} from "../../services/processInputClient";
import type { Passage } from "../../types/passage";
import { NormalizationOptionsPanel } from "./NormalizationOptionsPanel";

type ImportTextPageProps = {
  onStartTyping: (passage: Passage) => void;
};

const sampleText = "The empire, however, expanded in 476.";

type RequestStatus = "idle" | "loading" | "success" | "error";

function buildImportedPassage(
  normalizedText: NormalizedTypingText,
  processedDocument: ProcessedDocumentSummary
): Passage {
  return {
    id: processedDocument.documentId,
    title: processedDocument.title,
    source: `${processedDocument.sourceType.toUpperCase()} import`,
    text: normalizedText.inputText,
    normalizedText
  };
}

function FaintDisplayPreview({
  normalizedText,
  placeholder
}: {
  normalizedText: NormalizedTypingText;
  placeholder: string;
}): React.JSX.Element {
  return (
    <div className="preview-text">
      {normalizedText.characterMap.length === 0 ? (
        <span className="muted">{placeholder}</span>
      ) : (
        normalizedText.characterMap.map((entry, index) => (
          <span
            className={entry.faint ? "faint-preview-char" : undefined}
            key={`${entry.displayIndex}-${index}`}
          >
            {entry.displayChar}
          </span>
        ))
      )}
    </div>
  );
}

function formatUploadLimit(): string {
  return `${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MiB`;
}

export function ImportTextPage({
  onStartTyping
}: ImportTextPageProps): React.JSX.Element {
  const [rawText, setRawText] = useState("");
  const [options, setOptions] = useState<NormalizationOptions>(
    defaultNormalizationOptions
  );
  const [normalizedText, setNormalizedText] = useState<NormalizedTypingText>(
    emptyNormalizedTypingText
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputVersion, setFileInputVersion] = useState(0);
  const [processedDocument, setProcessedDocument] =
    useState<ProcessedDocumentSummary | null>(null);
  const [processStatus, setProcessStatus] = useState<RequestStatus>("idle");
  const [normalizeStatus, setNormalizeStatus] =
    useState<RequestStatus>("idle");
  const [processError, setProcessError] = useState<string | null>(null);
  const [normalizationError, setNormalizationError] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (processedDocument === null) {
      setNormalizedText(emptyNormalizedTypingText);
      setNormalizeStatus("idle");
      setNormalizationError(null);
      return;
    }

    let cancelled = false;
    setNormalizeStatus("loading");
    setNormalizationError(null);

    void normalizeDocument({
      documentId: processedDocument.documentId,
      options
    })
      .then((nextText) => {
        if (!cancelled) {
          setNormalizedText(nextText);
          setNormalizeStatus("success");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setNormalizedText(emptyNormalizedTypingText);
          setNormalizeStatus("error");
          setNormalizationError(
            error instanceof Error ? error.message : "Normalization failed"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [options, processedDocument]);

  const resetProcessedState = (): void => {
    setProcessedDocument(null);
    setNormalizedText(emptyNormalizedTypingText);
    setProcessStatus("idle");
    setNormalizeStatus("idle");
    setProcessError(null);
    setNormalizationError(null);
  };

  const processImport = async (): Promise<void> => {
    const pastedText = rawText;
    if (selectedFile === null && pastedText.trim().length === 0) return;

    setProcessStatus("loading");
    setProcessError(null);
    setNormalizationError(null);
    setNormalizedText(emptyNormalizedTypingText);

    try {
      const document =
        selectedFile === null
          ? await processPastedText({
              title: "Imported paste",
              text: pastedText
            })
          : await processImportFile(selectedFile);
      setProcessedDocument(document);
      setProcessStatus("success");
    } catch (error) {
      setProcessedDocument(null);
      setProcessStatus("error");
      setProcessError(
        error instanceof Error ? error.message : "Document processing failed"
      );
    }
  };

  const canProcess =
    processStatus !== "loading" &&
    (selectedFile !== null || rawText.trim().length > 0);
  const canStart =
    processedDocument !== null &&
    normalizeStatus === "success" &&
    normalizedText.inputText.trim().length > 0;
  const previewPlaceholder =
    processedDocument === null
      ? "process a document first"
      : normalizeStatus === "loading"
        ? "normalizing..."
        : "nothing to preview";
  const requiredInputPlaceholder =
    processedDocument === null
      ? "process a document first"
      : normalizeStatus === "loading"
        ? "normalizing..."
        : "nothing to type";

  return (
    <section className="import-page full-width-padding">
      <div className="import-layout">
        <div className="import-editor">
          <label className="field-label" htmlFor="rawTextInput">
            import text
          </label>
          <textarea
            id="rawTextInput"
            className="raw-text-input"
            placeholder={sampleText}
            value={rawText}
            onChange={(event) => {
              setSelectedFile(null);
              setFileInputVersion((current) => current + 1);
              resetProcessedState();
              setRawText(event.currentTarget.value);
            }}
          />
          <div className="file-import">
            <label className="field-label" htmlFor="fileImportInput">
              upload txt/pdf
            </label>
            <div className="file-import-row">
              <input
                key={fileInputVersion}
                id="fileImportInput"
                type="file"
                accept=".txt,.pdf,text/plain,application/pdf"
                onChange={(event) => {
                  resetProcessedState();
                  setSelectedFile(event.currentTarget.files?.[0] ?? null);
                }}
              />
              <button
                type="button"
                className="button"
                disabled={selectedFile === null}
                onClick={() => {
                  setSelectedFile(null);
                  setFileInputVersion((current) => current + 1);
                  resetProcessedState();
                }}
              >
                clear file
              </button>
            </div>
            <div className="file-import-meta">
              {processedDocument !== null
                ? `${processedDocument.title} / ${processedDocument.sourceType} / ${processedDocument.metadata.wordCount} words`
                : selectedFile === null
                  ? `select a .txt or text-based .pdf file, max ${formatUploadLimit()}`
                  : `${selectedFile.name} ready to process`}
            </div>
          </div>
          <div className="import-actions">
            <button
              type="button"
              className="button"
              onClick={() => {
                setSelectedFile(null);
                setFileInputVersion((current) => current + 1);
                resetProcessedState();
                setRawText(sampleText);
                setOptions({
                  ...defaultNormalizationOptions,
                  convertNumbersToWords: true
                });
              }}
            >
              load sample
            </button>
            <button
              type="button"
              className="button"
              disabled={!canProcess}
              onClick={() => {
                void processImport();
              }}
            >
              {processStatus === "loading" ? "processing" : "process/import"}
            </button>
            <button
              type="button"
              className="button main"
              disabled={!canStart}
              onClick={() => {
                if (!canStart || processedDocument === null) return;
                onStartTyping(
                  buildImportedPassage(normalizedText, processedDocument)
                );
              }}
            >
              start typing
            </button>
          </div>
          {processedDocument !== null ? (
            <div className="processed-document-meta">
              processed {processedDocument.documentId}
            </div>
          ) : null}
          {processError !== null ? (
            <div className="import-error">{processError}</div>
          ) : null}
          {normalizationError !== null ? (
            <div className="import-error">{normalizationError}</div>
          ) : null}
        </div>

        <NormalizationOptionsPanel options={options} onChange={setOptions} />

        <div className="normalization-preview">
          <div className="preview-group">
            <div className="preview-label">display</div>
            <FaintDisplayPreview
              normalizedText={normalizedText}
              placeholder={previewPlaceholder}
            />
          </div>
          <div className="preview-group">
            <div className="preview-label">required input</div>
            <div className="preview-text required">
              {normalizedText.inputText || (
                <span className="muted">{requiredInputPlaceholder}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
