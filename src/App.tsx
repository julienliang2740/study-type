import { TypingTest } from "./components/TypingTest/TypingTest";
import { samplePassages } from "./data/samplePassages";

export default function App(): React.JSX.Element {
  return (
    <div id="app" className="content-grid">
      <header className="topbar">
        <div className="brand">type-study</div>
        <div className="test-meta">words</div>
      </header>
      <main className="full-width content-grid">
        <TypingTest passages={samplePassages} />
      </main>
    </div>
  );
}
