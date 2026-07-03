import type { NormalizationOptions } from "../../types/normalization";

type NormalizationOptionsPanelProps = {
  options: NormalizationOptions;
  disabled?: boolean;
  onChange: (options: NormalizationOptions) => void;
};

const optionLabels: Array<{
  key: keyof NormalizationOptions;
  label: string;
}> = [
  { key: "lowercase", label: "lowercase" },
  {
    key: "removePunctuationFromInput",
    label: "remove punctuation from input"
  },
  {
    key: "showPunctuationFaintly",
    label: "show punctuation faintly"
  },
  { key: "collapseLineBreaks", label: "collapse line breaks" },
  { key: "preserveParagraphBreaks", label: "preserve paragraph breaks" },
  { key: "normalizeQuotesAndDashes", label: "normalize quotes and dashes" },
  { key: "convertNumbersToWords", label: "convert numbers to words" }
];

export function NormalizationOptionsPanel({
  options,
  disabled = false,
  onChange
}: NormalizationOptionsPanelProps): React.JSX.Element {
  return (
    <fieldset className="normalization-options" disabled={disabled}>
      <legend>normalization</legend>
      {optionLabels.map(({ key, label }) => (
        <label className="checkbox-row" key={key}>
          <input
            type="checkbox"
            checked={options[key]}
            onChange={(event) => {
              onChange({
                ...options,
                [key]: event.currentTarget.checked
              });
            }}
          />
          <span>{label}</span>
        </label>
      ))}
    </fieldset>
  );
}
