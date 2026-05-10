import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, FileText } from "lucide-react";
import { TerminalLoader } from "@/components/TerminalLoader";
import { PillMultiSelect } from "@/components/PillMultiSelect";
import { storeActions } from "@/lib/store";
import { mockCorpus } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Analyze a Writing Corpus — Tone & Style" },
      { name: "description", content: "Upload writing to extract a psycholinguistic style profile." },
    ],
  }),
});

const EXTRACTION_LINES = [
  "Parsing corpus across registers (WhatsApp · Slack · Email)...",
  "Extracting coarse signal — social orientation and register...",
  "Mapping discourse structure and information flow...",
  "Detecting prosodic compensation patterns (elongation, stacking)...",
  "Computing pronoun ratio and politeness strategy...",
  "Analyzing hedging language and intensifier distribution...",
  "Calibrating register-shift triggers...",
  "Building cognitive style hierarchy (coarse → mid → fine)...",
  "Crystallizing your linguistic fingerprint...",
];

function Home() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [name, setName] = useState("Reza — Mixed Corpus");
  const [sources, setSources] = useState<string[]>(["Email", "Slack", "WhatsApp"]);
  const [label, setLabel] = useState("Gmail sent folder");
  const [langs, setLangs] = useState<string[]>(["English"]);
  const [loading, setLoading] = useState(false);

  const onAnalyze = () => {
    setLoading(true);
  };

  const onLoaderDone = () => {
    const derivedType =
      sources.length === 0 ? "Mixed" :
      sources.length > 1 ? "Mixed" :
      (["Email", "Slack", "WhatsApp"].includes(sources[0]) ? sources[0] : "Mixed");
    storeActions.addCorpus({
      ...mockCorpus,
      id: `corpus-${Date.now()}`,
      name: name || mockCorpus.name,
      source_type: derivedType as any,
      sources,
      source_label: label,
      language: langs.join(" + ") || "English",
    });
    setLoading(false);
    navigate({ to: "/profile" });
  };

  const onFile = (f: File) => {
    setFilename(f.name);
    f.text().then(setText);
  };

  return (
    <>
      {loading && (
        <TerminalLoader lines={EXTRACTION_LINES} intervalMs={1300} onDone={onLoaderDone} />
      )}

      <header className="mb-8">
        <h1 className="text-[34px] text-tighter text-text-primary leading-[1.1]">
          Analyze a Writing Corpus
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Upload or paste real writing to extract a psycholinguistic style profile.
        </p>
      </header>

      <div className="border border-border bg-surface">
        {/* Tabs */}
        <div className="flex border-b border-border">
          {(["paste", "upload"] as const).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-5 py-3 text-sm transition-colors ${
                  active ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t === "paste" ? "Paste Text" : "Upload File"}
                {active && (
                  <span className="absolute left-0 right-0 -bottom-px h-px bg-indigo" />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {tab === "paste" ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste emails, Slack messages, texts — separated by ---"
              className="w-full min-h-[220px] bg-background border border-border p-4 font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo resize-y"
            />
          ) : (
            <label className="flex flex-col items-center justify-center min-h-[220px] bg-background border border-dashed border-border hover:border-indigo cursor-pointer transition-colors">
              <input
                type="file"
                accept=".txt"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
              {filename ? (
                <div className="text-center">
                  <FileText className="size-8 mx-auto text-indigo mb-3" />
                  <div className="font-mono text-sm text-text-primary">{filename}</div>
                  <div className="text-xs text-text-muted mt-1">{text.length} chars loaded</div>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="size-8 mx-auto text-text-muted mb-3" />
                  <div className="text-sm text-text-secondary">
                    Drop a <span className="font-mono text-text-primary">.txt</span> file or click to browse
                  </div>
                </div>
              )}
            </label>
          )}

          <div className="grid grid-cols-2 gap-3 mt-5">
            <Field label="Corpus Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Source Label">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Gmail sent folder"
                className="input"
              />
            </Field>
          </div>

          <div className="mt-4">
            <label className="block text-[10px] small-caps text-text-muted mb-1.5">Source Type</label>
            <PillMultiSelect
              options={["Email", "Slack", "WhatsApp"]}
              value={sources}
              onChange={setSources}
              customPlaceholder="e.g. Discord, LinkedIn"
            />
          </div>

          <div className="mt-4">
            <label className="block text-[10px] small-caps text-text-muted mb-1.5">Language</label>
            <PillMultiSelect
              options={["English", "Persian/Farsi", "Spanish", "French"]}
              value={langs}
              onChange={setLangs}
              customPlaceholder="e.g. German"
            />
          </div>

          <button
            onClick={onAnalyze}
            className="mt-5 w-full bg-indigo hover:bg-indigo/90 text-white text-sm font-medium py-3 rounded-sm transition-colors"
          >
            Analyze Style →
          </button>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: var(--background);
          border: 1px solid var(--border);
          color: var(--text-primary);
          padding: 8px 10px;
          font-size: 13px;
          border-radius: 3px;
          outline: none;
        }
        .input:focus { border-color: var(--indigo); }
      `}</style>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] small-caps text-text-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}
