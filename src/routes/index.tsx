import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { PillMultiSelect } from "@/components/PillMultiSelect";
import { storeActions, useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Analyze a Writing Corpus — Tone & Style" },
      { name: "description", content: "Upload writing to extract a psycholinguistic style profile." },
    ],
  }),
});

function Home() {
  const { extraction } = useStore();
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sources, setSources] = useState<string[]>(["Email"]);
  const [label, setLabel] = useState("");
  const [langs, setLangs] = useState<string[]>(["English"]);
  const [error, setError] = useState<string | null>(null);

  const loading = extraction.active;

  const messageCount = text.trim()
    ? text.split(/^---\s*$/m).map((s) => s.trim()).filter(Boolean).length
    : 0;
  const tooSmall = messageCount > 0 && messageCount < 5;

  // Surface async extraction errors from the global store
  useEffect(() => {
    if (extraction.error) setError(extraction.error);
  }, [extraction.error]);

  const onAnalyze = () => {
    setError(null);
    if (!text.trim()) { setError("Paste some writing first."); return; }
    if (!name.trim()) { setError("Give the corpus a name."); return; }

    const source_type = (sources[0] || "custom").toLowerCase();
    storeActions.startExtraction({
      name,
      text,
      source_type,
      source_label: label,
      language: langs.join(" + ") || "English",
    });
  };

  const onFile = (f: File) => {
    setFilename(f.name);
    f.text().then(setText);
  };

  return (
    <>
      <header className="mb-8">
        <h1 className="text-[34px] text-tighter text-text-primary leading-[1.1]">
          Analyze a Writing Corpus
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Upload or paste real writing to extract a psycholinguistic style profile.
        </p>
      </header>

      <div className="border border-border bg-surface">
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
                {active && <span className="absolute left-0 right-0 -bottom-px h-px bg-indigo" />}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {tab === "paste" ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste emails, Slack messages, texts, DMs, journal entries — anything you've written."
              className="w-full min-h-[220px] bg-background border border-border p-4 font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-indigo resize-y"
            />
          ) : (
            <FileDropZone
              filename={filename}
              charCount={text.length}
              onFile={onFile}
              onClear={() => { setFilename(null); setText(""); }}
            />
          )}

          <div className="grid grid-cols-2 gap-3 mt-5">
            <Field label="Corpus Name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My Mixed Corpus" className="input" />
            </Field>
            <Field label="Source Label">
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Gmail sent folder" className="input" />
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

          {error && (
            <div className="mt-4 border border-danger/50 bg-danger/10 text-danger text-xs px-3 py-2 rounded-sm font-mono">
              {error}
            </div>
          )}

          {messageCount > 0 && (
            <div className={`mt-3 text-xs font-mono ${
              tooSmall ? "text-danger"
              : messageCount < 20 ? "text-warning"
              : messageCount < 50 ? "text-text-muted"
              : "text-success"
            }`}>
              {tooSmall && `✗ Too small — minimum 5 messages required (${messageCount} detected)`}
              {messageCount >= 5 && messageCount < 20 && `⚠ ${messageCount} messages detected — low confidence profile. Add more for better results.`}
              {messageCount >= 20 && messageCount < 50 && `○ ${messageCount} messages detected — medium confidence.`}
              {messageCount >= 50 && `✓ ${messageCount} messages detected — good corpus size.`}
            </div>
          )}

          <button
            onClick={onAnalyze}
            disabled={loading || tooSmall}
            className="mt-5 w-full bg-indigo hover:bg-indigo-hover hover:shadow-[0_0_0_3px_color-mix(in_oklab,var(--indigo)_25%,transparent)] disabled:opacity-50 text-white text-sm font-medium py-3 rounded-sm transition-colors"
          >
            Analyze Style →
          </button>
        </div>
      </div>

      <style>{`
        .input { width:100%; background:var(--background); border:1px solid var(--border); color:var(--text-primary); padding:8px 10px; font-size:13px; border-radius:3px; outline:none; }
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

function FileDropZone({
  filename,
  charCount,
  onFile,
  onClear,
}: {
  filename: string | null;
  charCount: number;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center min-h-[220px] bg-background border border-dashed transition-colors ${
        dragOver ? "border-indigo bg-indigo/5" : "border-border hover:border-indigo"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {filename ? (
        <div className="text-center">
          <FileText className="size-8 mx-auto text-indigo mb-3" />
          <div className="font-mono text-sm text-text-primary">{filename}</div>
          <div className="text-xs text-text-muted mt-1">{charCount} chars loaded</div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-xs px-3 py-1.5 border border-border text-text-secondary hover:text-text-primary hover:border-indigo rounded-sm transition-colors"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-border text-text-secondary hover:text-danger hover:border-danger/50 rounded-sm transition-colors"
            >
              <X className="size-3" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
        >
          <Upload className="size-8 text-text-muted mb-3" />
          <div className="text-sm text-text-secondary">
            Drop a <span className="font-mono text-text-primary">.txt</span> file or click to browse
          </div>
        </button>
      )}
    </div>
  );
}
