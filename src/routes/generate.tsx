import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useStore, storeActions } from "@/lib/store";
import { mockGenerations, type ContextType, type Generation } from "@/lib/mock-data";

export const Route = createFileRoute("/generate")({
  component: GeneratePage,
  head: () => ({
    meta: [
      { title: "Generate — Tone & Style" },
      { name: "description", content: "Generate text in your captured voice." },
    ],
  }),
});

const CONTEXT_HINTS: Record<string, ContextType> = {
  Email: "Formal Email",
  Gmail: "Formal Email",
  Slack: "Slack",
  WhatsApp: "Text",
  SMS: "Text",
  Text: "Text",
};

function inferContextType(label: string): ContextType {
  for (const [k, v] of Object.entries(CONTEXT_HINTS)) {
    if (label.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return "Text";
}

const LOADER_LINES = [
  "Internalizing style profile...",
  "Applying register context...",
  "Generating in your voice...",
];

function GeneratePage() {
  const { corpora, activeCorpusId } = useStore();
  const corpus = corpora.find((c) => c.id === activeCorpusId) ?? corpora[0];
  const sourcePills = corpus?.sources ?? [];
  const [selected, setSelected] = useState<string>(sourcePills[0] ?? "Custom");
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");
  const activeContextLabel = customMode ? customText.trim() || "Custom" : selected;
  const ctx: ContextType = inferContextType(activeContextLabel);
  const [prompt, setPrompt] = useState("Write a follow-up email to a recruiter after a first interview");
  const [phase, setPhase] = useState<"idle" | "loading" | "result">("idle");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<Generation | null>(null);
  const [resultLabel, setResultLabel] = useState<string>("");
  const [copied, setCopied] = useState(false);

  if (!corpus) {
    return <div className="text-text-secondary text-sm">No corpus. <Link to="/" className="text-indigo">Add one →</Link></div>;
  }

  const onGenerate = () => {
    setPhase("loading");
    setStep(0);
    setResult(null);
    let s = 0;
    const tick = () => {
      s++;
      setStep(s);
      if (s < LOADER_LINES.length) setTimeout(tick, 500);
    };
    setTimeout(tick, 500);
    setTimeout(() => {
      const base = mockGenerations.find((g) => g.context === ctx) ?? mockGenerations[0];
      const gen: Generation = { ...base, id: `gen-${Date.now()}`, prompt, context: ctx, date: new Date().toISOString().slice(0,10) };
      setResult(gen);
      setResultLabel(activeContextLabel);
      setPhase("result");
    }, 1500);
  };

  const onSave = () => {
    if (result) storeActions.addGeneration(result);
  };

  const onCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const p = corpus.profile;

  return (
    <div className="-mx-4 grid grid-cols-[300px_1fr] gap-6 pb-20">
      {/* Left summary */}
      <aside className="sticky top-10 self-start border border-border bg-surface p-4 text-sm">
        <div className="text-[10px] small-caps text-text-muted mb-3">Active Profile</div>
        <div className="text-text-primary text-tight mb-4 truncate">{corpus.name}</div>

        <div className="mb-4">
          <div className="flex justify-between mb-1.5">
            <span className="text-[10px] small-caps text-text-muted">Formality</span>
            <span className="font-mono text-xs text-text-primary">{p.global.formality.toFixed(2)}</span>
          </div>
          <div className="h-1 bg-surface-elevated">
            <div className="h-full bg-indigo" style={{ width: `${p.global.formality * 100}%` }} />
          </div>
        </div>

        <Mini label="Register" value={p.global.register} />
        <Mini label="Tone" value={p.global.overall_tone} />

        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <CogLine k="COARSE" v={p.cognitive.coarse} />
          <CogLine k="MID" v={p.cognitive.mid} />
          <CogLine k="FINE" v={p.cognitive.fine} />
        </div>
      </aside>

      {/* Right pane */}
      <div className="min-w-0">
        <h1 className="text-[28px] text-tighter text-text-primary mb-6">Generate</h1>

        {/* Context pills */}
        <label className="block text-[10px] small-caps text-text-muted mb-1.5">Context</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {sourcePills.map((c) => {
            const active = !customMode && c === selected;
            return (
              <button
                key={c}
                onClick={() => { setCustomMode(false); setSelected(c); }}
                className={`px-3.5 py-1.5 text-xs rounded-sm border transition-colors ${
                  active
                    ? "bg-indigo border-indigo text-white"
                    : "border-border text-text-secondary hover:text-text-primary hover:border-text-muted"
                }`}
              >
                {c}
              </button>
            );
          })}
          <button
            onClick={() => setCustomMode(true)}
            className={`px-3.5 py-1.5 text-xs rounded-sm border transition-colors ${
              customMode
                ? "bg-indigo border-indigo text-white"
                : "border-dashed border-border text-text-secondary hover:text-text-primary hover:border-text-muted"
            }`}
          >
            + Custom
          </button>
        </div>

        {customMode && (
          <input
            autoFocus
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="describe the context (e.g. LinkedIn DM to a former colleague)"
            className="w-full mb-5 bg-surface border border-indigo p-2.5 font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        )}
        {!customMode && <div className="mb-5" />}

        <label className="block text-[10px] small-caps text-text-muted mb-1.5">Writing Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Write a follow-up email to a recruiter after a first interview"
          className="w-full min-h-[120px] bg-surface border border-border p-3 font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo resize-y"
        />

        <button
          onClick={onGenerate}
          className="mt-3 w-full bg-indigo hover:bg-indigo-hover hover:shadow-[0_0_0_3px_color-mix(in_oklab,var(--indigo)_25%,transparent)] text-white text-sm py-3 rounded-sm"
        >
          Generate
        </button>

        {/* Loading */}
        {phase === "loading" && (
          <div className="mt-6 border border-border bg-surface p-5 font-mono text-sm">
            {LOADER_LINES.slice(0, step + 1).map((l, i) => (
              <div
                key={i}
                className={i < step ? "text-text-muted" : "text-text-primary blink-cursor"}
              >
                <span className="text-indigo mr-2">›</span>{l}
              </div>
            ))}
          </div>
        )}

        {/* Result */}
        {phase === "result" && result && (
          <>
            <div className="mt-6 border border-border bg-surface">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <span className="text-[10px] small-caps text-text-muted">Generated Output</span>
                <span className="text-[10px] small-caps px-2 py-0.5 border border-indigo text-indigo rounded-sm">
                  {resultLabel || result.context}
                </span>
              </div>
              <pre className="font-mono text-sm text-text-primary p-5 whitespace-pre-wrap leading-relaxed">{result.output}</pre>
            </div>

            <div className="mt-3 flex gap-2">
              <button onClick={onGenerate} className="px-4 py-2 text-xs border border-border rounded-sm text-text-secondary hover:text-text-primary hover:border-text-muted">
                Regenerate
              </button>
              <button onClick={onCopy} className="px-4 py-2 text-xs border border-border rounded-sm text-text-secondary hover:text-text-primary hover:border-text-muted inline-flex items-center gap-1.5">
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button onClick={onSave} className="ml-auto px-4 py-2 text-xs bg-indigo hover:bg-indigo-hover text-white rounded-sm transition-colors">
                Save
              </button>
            </div>

            <ScoreCard score={result.score} />
          </>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2">
      <div className="text-[10px] small-caps text-text-muted">{label}</div>
      <div className="text-xs text-text-primary truncate">{value}</div>
    </div>
  );
}

function CogLine({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] text-indigo tracking-wider">{k}</div>
      <div className="text-xs text-text-secondary line-clamp-1">{v}</div>
    </div>
  );
}

function ScoreCard({ score }: { score: Generation["score"] }) {
  const color =
    score.overall >= 0.75 ? "text-success" :
    score.overall >= 0.5 ? "text-warning" : "text-danger";
  return (
    <div className="mt-5 border border-border bg-surface p-6">
      <div className="text-center mb-6">
        <div className={`font-mono text-6xl ${color}`}>{score.overall.toFixed(3)}</div>
        <div className="text-[10px] small-caps text-text-muted mt-2">Style Match Score</div>
      </div>

      <div className="space-y-3 mb-5">
        {[
          { k: "Style Embedding", v: score.embedding },
          { k: "Programmatic", v: score.programmatic },
          { k: "LLM Judge", v: score.llm_judge },
        ].map((r) => (
          <div key={r.k}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-text-secondary">{r.k}</span>
              <span className="font-mono text-text-primary">{(r.v * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1 bg-surface-elevated">
              <div className="h-full bg-indigo" style={{ width: `${r.v * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-text-secondary italic leading-relaxed border-t border-border pt-4">
        {score.reasoning}
      </p>
    </div>
  );
}
