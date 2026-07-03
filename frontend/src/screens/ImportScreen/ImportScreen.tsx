import { useEffect, useMemo, useState } from "react";
import {
  emptyNormalizedTypingText,
  defaultNormalizationOptions,
  type NormalizationOptions,
  type NormalizedTypingText
} from "../../types/normalization";
import {
  MAX_UPLOAD_BYTES,
  formatUploadLimit,
  processImportFile,
  processPastedText
} from "../../services/processInputClient";
import { normalizeDocument } from "../../services/normalizationClient";
import type { ProcessedDocumentSummary } from "../../types/processInput";
import type { Passage } from "../../types/passage";
import { NormalizationOptionsPanel } from "./NormalizationOptionsPanel";

type ImportScreenProps = {
  onStartTyping: (passage: Passage) => void;
};

type RequestStatus = "idle" | "loading" | "success" | "error";

const sampleText =
  "The empire, however, expanded in 476. Its roads, ports, and records made long-distance administration possible.";

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

function validateSelectedFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File uploads are limited to ${formatUploadLimit()}.`;
  }

  const extension = getFileExtension(file.name);
  const supported =
    extension === ".txt" ||
    extension === ".pdf" ||
    file.type === "text/plain" ||
    file.type === "application/pdf";

  return supported ? null : "Choose a .txt or text-based .pdf file.";
}

function buildImportedPassage(
  processedDocument: ProcessedDocumentSummary,
  normalizedText: NormalizedTypingText
): Passage {
  return {
    id: processedDocument.documentId,
    title: processedDocument.title,
    source: `${processedDocument.sourceType.toUpperCase()} import`,
    sourceKind: "import",
    text: normalizedText.inputText,
    normalizedText
  };
}

function FaintPreview({
  normalizedText,
  placeholder
}: {
  normalizedText: NormalizedTypingText;
  placeholder: string;
}): React.JSX.Element {
  if (normalizedText.characterMap.length === 0) {
    return <span className="muted">{placeholder}</span>;
  }

  return (
    <>
      {normalizedText.characterMap.map((entry, index) => (
        <span
          className={entry.faint ? "preview-faint" : undefined}
          key={`${entry.displayIndex}-${index}`}
        >
          {entry.displayChar}
        </span>
      ))}
    </>
  );
}

export function ImportScreen({
  onStartTyping
}: ImportScreenProps): React.JSX.Element {
  const [rawText, setRawText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputVersion, setFileInputVersion] = useState(0);
  const [options, setOptions] = useState<NormalizationOptions>(
    defaultNormalizationOptions
  );
  const [processedDocument, setProcessedDocument] =
    useState<ProcessedDocumentSummary | null>(null);
  const [normalizedText, setNormalizedText] = useState<NormalizedTypingText>(
    emptyNormalizedTypingText
  );
  const [processStatus, setProcessStatus] = useState<RequestStatus>("idle");
  const [normalizeStatus, setNormalizeStatus] =
    useState<RequestStatus>("idle");
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [normalizationError, setNormalizationError] = useState<string | null>(
    null
  );

  const hasSource = selectedFile !== null || rawText.trim().length > 0;
  const canProcess =
    hasSource && sourceError === null && processStatus !== "loading";
  const canStart =
    processedDocument !== null &&
    normalizeStatus === "success" &&
    normalizedText.inputText.trim().length > 0;
  const metadataText = useMemo(() => {
    if (processedDocument !== null) {
      return `${processedDocument.title} / ${processedDocument.sourceType} / ${processedDocument.metadata.wordCount} words`;
    }

    if (selectedFile !== null) {
      return `${selectedFile.name} / ${Math.ceil(selectedFile.size / 1024)} KiB`;
    }

    return `select .txt or text-based .pdf, max ${formatUploadLimit()}`;
  }, [processedDocument, selectedFile]);

  const resetProcessedState = (): void => {
    setProcessedDocument(null);
    setNormalizedText(emptyNormalizedTypingText);
    setProcessStatus("idle");
    setNormalizeStatus("idle");
    setProcessError(null);
    setNormalizationError(null);
  };

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
      .then((response) => {
        if (cancelled) return;
        setNormalizedText(response);
        setNormalizeStatus("success");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setNormalizedText(emptyNormalizedTypingText);
        setNormalizeStatus("error");
        setNormalizationError(
          error instanceof Error ? error.message : "Normalization failed"
        );
      });

    return () => {
      cancelled = true;
    };
  }, [processedDocument, options]);

  const processImport = async (): Promise<void> => {
    if (!canProcess) return;

    setProcessStatus("loading");
    setProcessError(null);
    setNormalizationError(null);
    setNormalizedText(emptyNormalizedTypingText);

    try {
      const processed =
        selectedFile === null
          ? await processPastedText({
              title: "Imported paste",
              text: rawText
            })
          : await processImportFile(selectedFile);

      setProcessedDocument(processed);
      setProcessStatus("success");
    } catch (error: unknown) {
      setProcessedDocument(null);
      setProcessStatus("error");
      setProcessError(
        error instanceof Error ? error.message : "Document processing failed"
      );
    }
  };

  return (
    <section className="import-screen" aria-label="Import study material">
      <div className="import-column import-source">
        <label className="field-label" htmlFor="rawTextInput">
          paste text
        </label>
        <textarea
          id="rawTextInput"
          className="raw-text-input"
          placeholder={sampleText}
          value={rawText}
          onChange={(event) => {
            setRawText(event.currentTarget.value);
            setSelectedFile(null);
            setFileInputVersion((current) => current + 1);
            setSourceError(null);
            resetProcessedState();
          }}
        />

        <div className="file-picker">
          <label className="field-label" htmlFor="fileImportInput">
            upload
          </label>
          <div className="file-row">
            <input
              key={fileInputVersion}
              id="fileImportInput"
              type="file"
              accept=".txt,.pdf,text/plain,application/pdf"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                setSelectedFile(file);
                setRawText("");
                resetProcessedState();
                setSourceError(file === null ? null : validateSelectedFile(file));
              }}
            />
            <button
              type="button"
              className="text-button"
              disabled={selectedFile === null}
              onClick={() => {
                setSelectedFile(null);
                setFileInputVersion((current) => current + 1);
                setSourceError(null);
                resetProcessedState();
              }}
            >
              clear
            </button>
          </div>
          <div className="file-meta">{metadataText}</div>
        </div>

        <div className="import-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setRawText(sampleText);
              setSelectedFile(null);
              setFileInputVersion((current) => current + 1);
              setSourceError(null);
              setOptions({
                ...defaultNormalizationOptions,
                convertNumbersToWords: true
              });
              resetProcessedState();
            }}
          >
            sample
          </button>
          <button
            type="button"
            className="text-button accent"
            disabled={!canProcess}
            onClick={() => {
              void processImport();
            }}
          >
            {processStatus === "loading" ? "processing" : "process/import"}
          </button>
          <button
            type="button"
            className="text-button accent"
            disabled={!canStart}
            onClick={() => {
              if (!canStart || processedDocument === null) return;
              onStartTyping(buildImportedPassage(processedDocument, normalizedText));
            }}
          >
            start typing
          </button>
        </div>

        {processedDocument !== null ? (
          <div className="status-line">processed {processedDocument.documentId}</div>
        ) : null}
        {sourceError !== null ? <div className="error-line">{sourceError}</div> : null}
        {processError !== null ? (
          <div className="error-line">{processError}</div>
        ) : null}
        {normalizationError !== null ? (
          <div className="error-line">{normalizationError}</div>
        ) : null}
      </div>

      <NormalizationOptionsPanel
        options={options}
        disabled={normalizeStatus === "loading"}
        onChange={setOptions}
      />

      <div className="normalization-preview">
        <div className="preview-panel">
          <div className="preview-label">display</div>
          <div className="preview-text">
            <FaintPreview
              normalizedText={normalizedText}
              placeholder={
                processedDocument === null
                  ? "process a document first"
                  : normalizeStatus === "loading"
                    ? "normalizing..."
                    : "nothing to preview"
              }
            />
          </div>
        </div>
        <div className="preview-panel">
          <div className="preview-label">required input</div>
          <div className="preview-text required">
            {normalizedText.inputText.length > 0 ? (
              normalizedText.inputText
            ) : (
              <span className="muted">
                {processedDocument === null
                  ? "process a document first"
                  : normalizeStatus === "loading"
                    ? "normalizing..."
                    : "normalized text is empty"}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
