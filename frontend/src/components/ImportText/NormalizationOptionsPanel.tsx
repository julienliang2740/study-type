import type { NormalizationOptions } from "../../services/normalizationClient";

type NormalizationOptionsPanelProps = {
  options: NormalizationOptions;
  onChange: (options: NormalizationOptions) => void;
};

const optionLabels: Array<{
  key: keyof NormalizationOptions;
  label: string;
}> = [
  { key: "lowercase", label: "lowercase everything" },
  {
    key: "removePunctuationFromInput",
    label: "remove punctuation from required typing"
  },
  {
    key: "showPunctuationFaintly",
    label: "show punctuation faintly but do not require typing"
  },
  { key: "collapseLineBreaks", label: "collapse line breaks" },
  { key: "preserveParagraphBreaks", label: "preserve paragraph breaks" },
  { key: "normalizeQuotesAndDashes", label: "normalize quotes/dashes" },
  { key: "convertNumbersToWords", label: "convert number digits to words" }
];

export function NormalizationOptionsPanel({
  options,
  onChange
}: NormalizationOptionsPanelProps): React.JSX.Element {
  return (
    <fieldset className="normalization-options">
      <legend>normalization</legend>
      {optionLabels.map(({ key, label }) => (
        <label className="checkbox-option" key={key}>
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
