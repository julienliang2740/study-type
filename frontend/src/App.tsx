import { useState } from "react";
import { samplePassages } from "./data/samplePassages";
import { ImportScreen } from "./screens/ImportScreen/ImportScreen";
import { TypingScreen } from "./screens/TypingScreen/TypingScreen";
import type { Passage } from "./types/passage";

type AppView = "typing" | "import";

export default function App(): React.JSX.Element {
  const [view, setView] = useState<AppView>("typing");
  const [passages, setPassages] = useState<Passage[]>(samplePassages);
  const [sessionKey, setSessionKey] = useState(0);

  const showSamples = (): void => {
    setPassages(samplePassages);
    setSessionKey((current) => current + 1);
    setView("typing");
  };

  const startImportedPassage = (passage: Passage): void => {
    setPassages([passage]);
    setSessionKey((current) => current + 1);
    setView("typing");
  };

  return (
    <div id="app" className="app-shell">
      <header className="topbar" aria-label="Primary">
        <button
          type="button"
          className="brand-button"
          onClick={showSamples}
          aria-label="Start built-in samples"
        >
          type-study
        </button>
        <nav className="topbar-nav" aria-label="Mode">
          <button
            type="button"
            className={view === "typing" ? "active" : undefined}
            onClick={showSamples}
          >
            type
          </button>
          <button
            type="button"
            className={view === "import" ? "active" : undefined}
            onClick={() => {
              setView("import");
            }}
          >
            import
          </button>
        </nav>
      </header>
      <main className="main-view">
        {view === "import" ? (
          <ImportScreen onStartTyping={startImportedPassage} />
        ) : (
          <TypingScreen key={sessionKey} passages={passages} />
        )}
      </main>
    </div>
  );
}
