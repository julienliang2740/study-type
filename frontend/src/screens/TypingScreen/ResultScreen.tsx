import type { TypingResult, TypingState } from "../../lib/typing/types";

type ResultScreenProps = {
  state: TypingState;
  result: TypingResult;
  onRestart: () => void;
  onNext: () => void;
};

export function ResultScreen({
  state,
  result,
  onRestart,
  onNext
}: ResultScreenProps): React.JSX.Element {
  const { passage } = state;
  const characters = result.characters;

  return (
    <section className="result-screen" tabIndex={-1}>
      <div className="result-primary">
        <div className="result-stat result-wpm">
          <div className="stat-label">wpm</div>
          <div className="stat-value">{Math.round(result.wpm)}</div>
        </div>
        <div className="result-stat result-accuracy">
          <div className="stat-label">acc</div>
          <div className="stat-value">{Math.round(result.accuracy)}%</div>
        </div>
      </div>

      <div className="result-secondary" aria-label="Detailed result stats">
        <div className="result-stat">
          <div className="stat-label">raw</div>
          <div className="stat-value small">{Math.round(result.rawWpm)}</div>
        </div>
        <div className="result-stat">
          <div className="stat-label">characters</div>
          <div className="stat-value small">
            {characters.correct}/{characters.incorrect}/{characters.extra}/
            {characters.missed}
          </div>
        </div>
        <div className="result-stat">
          <div className="stat-label">time</div>
          <div className="stat-value small">{result.elapsedSeconds}s</div>
        </div>
        <div className="result-stat">
          <div className="stat-label">test type</div>
          <div className="stat-value small">{passage.sourceKind}</div>
        </div>
      </div>

      <div className="result-source">
        <div className="source-title">{passage.title}</div>
        <div className="source-meta">{passage.source}</div>
      </div>

      <div className="result-actions">
        <button
          type="button"
          className="icon-button"
          aria-label="Next test"
          onClick={onNext}
        >
          →
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Repeat test"
          onClick={onRestart}
        >
          ↻
        </button>
      </div>
    </section>
  );
}
