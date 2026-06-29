import type { Passage } from "../../types/passage";
import type { TypingResult } from "../../types/typing";
import { RestartIcon } from "./icons";

type ResultScreenProps = {
  passage: Passage;
  result: TypingResult;
  onRestart: () => void;
};

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(2)}s`;
}

export function ResultScreen({
  passage,
  result,
  onRestart
}: ResultScreenProps): React.JSX.Element {
  return (
    <section id="result" className="content-grid full-width-padding">
      <div className="wrapper">
        <div className="stats">
          <div className="group wpm">
            <div className="top">wpm</div>
            <div className="bottom">{Math.round(result.wpm)}</div>
          </div>
          <div className="group acc">
            <div className="top">acc</div>
            <div className="bottom">{Math.round(result.accuracy)}%</div>
          </div>
        </div>

        <div className="stats morestats">
          <div className="group">
            <div className="top">time</div>
            <div className="bottom">{formatSeconds(result.elapsedSeconds)}</div>
          </div>
          <div className="group">
            <div className="top">chars</div>
            <div className="bottom">{result.correctCharacters}</div>
          </div>
          <div className="group source">
            <div className="top">source</div>
            <div className="bottom">{passage.source}</div>
          </div>
        </div>

        <div className="result-passage">
          <div className="title">{passage.title}</div>
        </div>

        <div className="buttons">
          <button
            type="button"
            className="iconButton"
            aria-label="Restart test"
            onClick={onRestart}
          >
            <RestartIcon />
          </button>
        </div>
      </div>
    </section>
  );
}
