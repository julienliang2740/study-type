import { useState } from "react";
import { ImportTextPage } from "./components/ImportText/ImportTextPage";
import { TypingTest } from "./components/TypingTest/TypingTest";
import { samplePassages } from "./data/samplePassages";
import type { Passage } from "./types/passage";

type AppView = "typing" | "import";

export default function App(): React.JSX.Element {
  const [view, setView] = useState<AppView>("typing");
  const [typingSessionKey, setTypingSessionKey] = useState(0);
  const [activePassages, setActivePassages] =
    useState<Passage[]>(samplePassages);

  const showSampleTyping = (): void => {
    setActivePassages(samplePassages);
    setTypingSessionKey((current) => current + 1);
    setView("typing");
  };

  const startImportedTyping = (passage: Passage): void => {
    setActivePassages([passage]);
    setTypingSessionKey((current) => current + 1);
    setView("typing");
  };

  return (
    <div id="app" className="content-grid">
      <header className="topbar">
        <div className="brand">type-study</div>
        <nav className="topbar-actions" aria-label="Mode">
          <button
            type="button"
            className={view === "typing" ? "active" : undefined}
            onClick={showSampleTyping}
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
      <main className="full-width content-grid">
        {view === "import" ? (
          <ImportTextPage onStartTyping={startImportedTyping} />
        ) : (
          <TypingTest key={typingSessionKey} passages={activePassages} />
        )}
      </main>
    </div>
  );
}
