import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { supabase, callFn } from "@/lib/supabase";

export const Route = createFileRoute("/generate")({
  component: GeneratePage,
  head: () => ({
    meta: [
      { title: "Generate — Tone & Style" },
      { name: "description", content: "Generate text in your captured voice." },
    ],
  }),
});

const LOADER_LINES = [
  "Internalizing style profile...",
  "Applying register context...",
  "Generating in your voice...",
];

const SOURCE_PILLS = ["Email", "Slack", "WhatsApp", "Text"];

function GeneratePage() {
  const { activeCorpusId } = useStore();
  const qc = useQueryClient();

  const { data: profileData } = useQuery({
    queryKey: ["style_profile", activeCorpusId],
    enabled: !!activeCorpusId,
    queryFn: async () => {
      const [corpusRes, profileRes] = await Promise.all([
        supabase.from("corpora").select("*").eq("id", activeCorpusId!).maybeSingle(),
        supabase.from("style_profiles").select("*").eq("corpus_id", activeCorpusId!).maybeSingle(),
      ]);
      if (corpusRes.error) throw corpusRes.error;
      if (profileRes.error) throw profileRes.error;
      return { corpus: corpusRes.data as any, profile: profileRes.data as any };
    },
  });

  const corpus = profileData?.corpus;
  const profile = profileData?.profile;

  const [selected, setSelected] = useState<string>(SOURCE_PILLS[0]);
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");
  const [prompt, setPrompt] = useState("");

  const PLACEHOLDERS: Record<string, string> = {
    Email: "Write a follow-up email to a recruiter after a first interview...",
    Slack: "Ask your team if the new pipeline is ready to test...",
    WhatsApp: "Text a close friend you haven't seen in a while...",
    Text: "Text a close friend you haven't seen in a while...",
  };
  const promptPlaceholder = customMode
    ? "Describe what you want to write..."
    : PLACEHOLDERS[selected] ?? "Describe what you want to write...";
  const [phase, setPhase] = useState<"idle" | "loading" | "scoring" | "result">("idle");
  const [step, setStep] = useState(0);
  const [output, setOutput] = useState<string>("");
  const [score, setScore] = useState<any>(null);
  const [resultLabel, setResultLabel] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!activeCorpusId) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-32">
        <div className="text-sm text-text-secondary mb-2">No corpus selected.</div>
        <div className="text-xs text-text-muted mb-6 max-w-sm">
          Choose one from the sidebar or upload a new one on the home page.
        </div>
        <Link
          to="/"
          className="px-4 py-2 text-xs border border-border rounded-sm text-text-secondary hover:text-text-primary hover:border-text-muted"
        >
          Go to Home
        </Link>
      </div>
    );
  }

  const activeContextLabel = customMode ? customText.trim() || "custom" : selected;

  const onGenerate = async () => {
    setPromptError(null);
    if (!prompt.trim()) {
      setPromptError("Write a prompt first.");
      return;
    }
    if (!profile?.id) {
      setError("Something went wrong on our end. Try refreshing the page.");
      return;
    }
    setError(null);
    setScoreError(null);
    setPhase("loading");
    setStep(0);
    setOutput("");
    setScore(null);

    const interval = setInterval(() => setStep((s) => Math.min(s + 1, LOADER_LINES.length - 1)), 1500);

    const friendlyGenError = (e: any): string => {
      const msg = String(e?.message || "").toLowerCase();
      if (msg.includes("required") || msg.includes("style_profile_id") || msg.includes("context_type")) {
        return "Something went wrong on our end. Try refreshing the page.";
      }
      if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("aborted")) {
        return "This is taking longer than expected. Try again with a shorter prompt.";
      }
      return "Generation failed. Check your connection and try again.";
    };

    try {
      const ctxLabel = activeContextLabel;
      const gen = await callFn<any>("generate", {
        style_profile_id: profile.id,
        prompt: prompt.trim(),
        context_type: ctxLabel.toLowerCase(),
      });
      clearInterval(interval);

      const text = gen.output_text ?? gen.output ?? gen.text ?? "";
      const generationId = gen.generation_id ?? gen.id;
      setOutput(text);
      setResultLabel(ctxLabel);
      setPhase("scoring");

      try {
        const sc = await callFn<any>("score", { generation_id: generationId });
        setScore(sc.score ?? sc);
      } catch {
        setScore(null);
        setScoreError("Couldn't score this output. The text was saved but the score is unavailable.");
      }
      setPhase("result");
      qc.invalidateQueries({ queryKey: ["history"] });
    } catch (e: any) {
      clearInterval(interval);
      setPhase("idle");
      setError(friendlyGenError(e));
    }
  };

  const onCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const profileRoot: any = profile ? (profile.profile ?? profile) : null;
  const g = profileRoot?.global ?? {};
  const m = profileRoot?.mid_level ?? {};
  const flat = { ...g, ...m } as any;
  const formality = Number(g.formality_score ?? profile?.formality_score ?? 0);
  const cog = profileRoot?.cognitive_spike ?? {};
  const dataConfidence = (profileRoot as any)?.extraction_metadata?.data_confidence as "low" | "medium" | "high" | undefined;

  return (
    <div className="pb-20">
      <div className="grid grid-cols-[1fr_280px] gap-8 items-start">
        <div className="min-w-0">
          <h1 className="text-[44px] text-tighter text-text-primary mb-6 leading-none">Generate</h1>

          <label className="block text-[10px] small-caps text-text-muted mb-1.5">Context</label>
          <div className="flex flex-wrap gap-2">
            {SOURCE_PILLS.map((c) => {
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
              placeholder="describe the context (e.g. LinkedIn DM)"
              className="w-full mt-3 bg-surface border border-indigo p-2.5 font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          )}

          <label className="block text-[10px] small-caps text-text-muted mb-1.5 mt-5">Writing Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); if (promptError) setPromptError(null); }}
            placeholder={promptPlaceholder}
            className="w-full min-h-[200px] bg-surface border border-border p-3 font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo resize-y"
          />

          {promptError && (
            <div className="mt-2 text-xs text-warning font-mono">{promptError}</div>
          )}

          {error && (
            <div className="mt-3 border border-warning/40 bg-warning/10 text-warning text-xs px-3 py-2 rounded-sm font-mono">
              {error}
            </div>
          )}

          <button
            onClick={onGenerate}
            disabled={phase === "loading" || phase === "scoring"}
            className="mt-4 w-full bg-indigo hover:bg-indigo-hover hover:shadow-[0_0_0_3px_color-mix(in_oklab,var(--indigo)_25%,transparent)] disabled:opacity-50 text-white text-base py-4 rounded-sm font-medium transition-all"
          >
            {phase === "loading" ? "Generating…" : phase === "scoring" ? "Scoring…" : "Generate"}
          </button>

          {dataConfidence === "low" && (
            <div className="mt-2 text-xs text-warning font-mono">
              Note: Low corpus confidence may affect output quality. Consider adding more writing samples.
            </div>
          )}

          {phase === "idle" && (
            <>
              <div className="mt-6 border border-dashed border-border bg-surface/40 p-8">
                <div className="text-[10px] small-caps text-text-muted mb-3">Output</div>
                <div className="text-sm text-text-muted font-mono">Generated text will appear here...</div>
              </div>
              <div className="mt-3 border border-dashed border-border bg-surface/40 p-8 text-center">
                <div className="font-mono text-6xl text-text-muted">— —</div>
                <div className="text-[10px] small-caps text-text-muted mt-2">Style Match Score</div>
              </div>
            </>
          )}

          {phase === "loading" && (
            <div className="mt-6 border border-border bg-surface p-5 font-mono text-sm">
              {LOADER_LINES.slice(0, step + 1).map((l, i) => (
                <div key={i} className={i < step ? "text-text-muted" : "text-text-primary blink-cursor"}>
                  <span className="text-indigo mr-2">›</span>{l}
                </div>
              ))}
            </div>
          )}

          {(phase === "scoring" || phase === "result") && output && (
            <>
              <div className="mt-6 border border-border bg-surface">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                  <span className="text-[10px] small-caps text-text-muted">Generated Output</span>
                  <span className="text-[10px] small-caps px-2 py-0.5 border border-indigo text-indigo rounded-sm">
                    {resultLabel}
                  </span>
                </div>
                <pre className="font-mono text-sm text-text-primary p-5 whitespace-pre-wrap leading-relaxed">{output}</pre>
              </div>

              <div className="mt-3 flex gap-2">
                <button onClick={onGenerate} className="px-4 py-2 text-xs border border-border rounded-sm text-text-secondary hover:text-text-primary hover:border-text-muted">
                  Regenerate
                </button>
                <button onClick={onCopy} className="px-4 py-2 text-xs border border-border rounded-sm text-text-secondary hover:text-text-primary hover:border-text-muted inline-flex items-center gap-1.5">
                  {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => {
                    const ctx = (customMode ? "custom" : selected).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "context";
                    const date = new Date().toISOString().slice(0, 10);
                    const blob = new Blob([output], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `generated-${ctx}-${date}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="ml-auto px-4 py-2 text-xs border border-border rounded-sm text-text-secondary hover:text-text-primary hover:border-text-muted"
                >
                  Export
                </button>
              </div>

              {phase === "scoring" && (
                <div className="mt-5 border border-border bg-surface p-6 text-center text-sm text-text-muted font-mono">
                  Scoring style match…
                </div>
              )}
              {phase === "result" && score && <ScoreCard score={score} />}
              {phase === "result" && !score && scoreError && (
                <div className="mt-5 border border-border bg-surface p-6 text-center text-sm text-text-muted font-mono">
                  {scoreError}
                </div>
              )}
            </>
          )}
        </div>

        <aside className="sticky top-6 self-start border border-border bg-surface p-4 text-sm w-[280px]">
          <div className="text-[10px] small-caps text-text-muted mb-3">Active Profile</div>
          <div className="text-text-primary text-tight mb-4 truncate">{corpus?.name ?? "—"}</div>

          {profile && (
            <>
              <div className="mb-4">
                <div className="flex justify-between mb-1.5">
                  <span className="text-[10px] small-caps text-text-muted">Formality</span>
                  <span className="font-mono text-xs text-text-primary">{formality.toFixed(2)}</span>
                </div>
                <div className="h-1 bg-surface-elevated">
                  <div className="h-full bg-indigo" style={{ width: `${formality * 100}%` }} />
                </div>
              </div>

              {flat.register && <Mini label="Register" value={flat.register} />}
              {flat.overall_tone && <Mini label="Tone" value={flat.overall_tone} />}

              <div className="mt-4 pt-4 border-t border-border space-y-3">
                {cog.coarse_signal && <CogLine k="COARSE" v={cog.coarse_signal} />}
                {cog.mid_signal && <CogLine k="MID" v={cog.mid_signal} />}
                {cog.fine_signal && <CogLine k="FINE" v={cog.fine_signal} />}
              </div>
            </>
          )}
          {!profile && <div className="text-xs text-text-muted">No style profile yet.</div>}
        </aside>
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

function ScoreCard({ score }: { score: any }) {
  const overall = Number(score.overall_score ?? score.overall ?? 0);
  const embed = Number(score?.style_embedding?.score ?? 0);
  const prog = Number(score?.programmatic?.score ?? 0);
  const judge = Number(score?.llm_judge?.score ?? 0);
  const reasoning = score?.llm_judge?.reasoning ?? score?.reasoning ?? "";
  const color = overall >= 0.75 ? "text-success" : overall >= 0.5 ? "text-warning" : "text-danger";

  return (
    <div className="mt-5 border border-border bg-surface p-6">
      <div className="text-center mb-6">
        <div className={`font-mono text-6xl ${color}`}>{overall.toFixed(3)}</div>
        <div className="text-[10px] small-caps text-text-muted mt-2">Style Match Score</div>
      </div>

      <div className="space-y-3 mb-5">
        {[
          { k: "Style Embedding", v: embed },
          { k: "Programmatic", v: prog },
          { k: "LLM Judge", v: judge },
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

      {reasoning && (
        <p className="text-xs text-text-secondary italic leading-relaxed border-t border-border pt-4">
          {reasoning}
        </p>
      )}

      {score?.data_quality && (() => {
        const dq = score.data_quality;
        const conf = String(dq.data_confidence ?? "").toUpperCase();
        const confColor = conf === "HIGH" ? "text-success" : conf === "MEDIUM" ? "text-warning" : conf === "LOW" ? "text-danger" : "text-text-secondary";
        const total = dq.total_features ?? 7;
        return (
          <div className="mt-5 border-t border-border pt-4">
            <div className="text-[10px] small-caps text-text-muted mb-2">Data Quality</div>
            <div className="text-xs font-mono text-text-secondary">
              Corpus: {dq.n_messages ?? "—"} messages · Confidence: <span className={confColor}>{conf || "—"}</span>
            </div>
            {(dq.reliable_features != null) && (
              <div className="text-xs font-mono text-text-secondary mt-1">
                Reliable features: {dq.reliable_features}/{total}
              </div>
            )}
            {dq.note && (
              <p className="text-xs text-text-muted italic mt-2">{dq.note}</p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
