import { useEffect, useState } from "react";
import {
  defaultNormalizationOptions,
  emptyNormalizedTypingText,
  normalizeImportedText,
  type NormalizationOptions,
  type NormalizedTypingText
} from "../../services/normalizationClient";
import {
  processImportFile,
  type ProcessedInputDocument
} from "../../services/processInputClient";
import type { Passage } from "../../types/passage";
import { NormalizationOptionsPanel } from "./NormalizationOptionsPanel";

type ImportTextPageProps = {
  onStartTyping: (passage: Passage) => void;
};

const sampleText = "The empire, however, expanded in 476.";

function buildImportedPassage(
  normalizedText: NormalizedTypingText,
  processedDocument: ProcessedInputDocument | null
): Passage {
  return {
    id: processedDocument?.id ?? `import-${Date.now()}`,
    title: processedDocument?.title ?? "Imported text",
    source:
      processedDocument === null
        ? "Local import"
        : `${processedDocument.sourceType.toUpperCase()} import`,
    text: normalizedText.inputText,
    normalizedText
  };
}

function FaintDisplayPreview({
  normalizedText
}: {
  normalizedText: NormalizedTypingText;
}): React.JSX.Element {
  return (
    <div className="preview-text">
      {normalizedText.characterMap.length === 0 ? (
        <span className="muted">nothing to preview</span>
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
  const [normalizationError, setNormalizationError] = useState<string | null>(
    null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedDocument, setProcessedDocument] =
    useState<ProcessedInputDocument | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileImportError, setFileImportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void normalizeImportedText({ rawText, options })
      .then((nextText) => {
        if (!cancelled) {
          setNormalizedText(nextText);
          setNormalizationError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setNormalizedText(emptyNormalizedTypingText);
          setNormalizationError(
            error instanceof Error ? error.message : "Normalization failed"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [options, rawText]);

  const canStart = normalizedText.inputText.trim().length > 0;

  const processSelectedFile = async (): Promise<void> => {
    if (selectedFile === null) return;

    setIsProcessingFile(true);
    setFileImportError(null);
    try {
      const document = await processImportFile(selectedFile);
      setProcessedDocument(document);
      setRawText(document.canonicalText);
    } catch (error) {
      setProcessedDocument(null);
      setFileImportError(
        error instanceof Error ? error.message : "File processing failed"
      );
    } finally {
      setIsProcessingFile(false);
    }
  };

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
              setProcessedDocument(null);
              setFileImportError(null);
              setRawText(event.currentTarget.value);
            }}
          />
          <div className="file-import">
            <label className="field-label" htmlFor="fileImportInput">
              upload txt/pdf
            </label>
            <div className="file-import-row">
              <input
                id="fileImportInput"
                type="file"
                accept=".txt,.pdf,text/plain,application/pdf"
                onChange={(event) => {
                  setSelectedFile(event.currentTarget.files?.[0] ?? null);
                  setFileImportError(null);
                }}
              />
              <button
                type="button"
                className="button"
                disabled={selectedFile === null || isProcessingFile}
                onClick={() => {
                  void processSelectedFile();
                }}
              >
                {isProcessingFile ? "processing" : "process file"}
              </button>
            </div>
            <div className="file-import-meta">
              {processedDocument !== null
                ? `${processedDocument.title} · ${processedDocument.sourceType} · ${processedDocument.metadata.wordCount} words`
                : selectedFile === null
                  ? "select a .txt or text-based .pdf file"
                  : `${selectedFile.name} ready to process`}
            </div>
            {fileImportError !== null ? (
              <div className="import-error">{fileImportError}</div>
            ) : null}
          </div>
          <div className="import-actions">
            <button
              type="button"
              className="button"
              onClick={() => {
                setProcessedDocument(null);
                setFileImportError(null);
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
              className="button main"
              disabled={!canStart}
              onClick={() => {
                if (!canStart) return;
                onStartTyping(
                  buildImportedPassage(normalizedText, processedDocument)
                );
              }}
            >
              start typing
            </button>
          </div>
          {normalizationError !== null ? (
            <div className="import-error">{normalizationError}</div>
          ) : null}
        </div>

        <NormalizationOptionsPanel options={options} onChange={setOptions} />

        <div className="normalization-preview">
          <div className="preview-group">
            <div className="preview-label">display</div>
            <FaintDisplayPreview normalizedText={normalizedText} />
          </div>
          <div className="preview-group">
            <div className="preview-label">required input</div>
            <div className="preview-text required">
              {normalizedText.inputText || (
                <span className="muted">nothing to type</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
