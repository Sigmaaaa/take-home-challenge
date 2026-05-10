import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import type { ContextType, Generation } from "@/lib/mock-data";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      { title: "Generation History — Tone & Style" },
      { name: "description", content: "Past generations and their style match scores." },
    ],
  }),
});

const FILTERS: ("All" | ContextType)[] = ["All", "Formal Email", "Slack", "Text"];

function HistoryPage() {
  const { history } = useStore();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = history.filter((g) => filter === "All" || g.context === filter);

  return (
    <div className="pb-20">
      <h1 className="text-[28px] text-tighter text-text-primary mb-6">Generation History</h1>

      <div className="flex gap-2 mb-5">
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
                active
                  ? "bg-indigo border-indigo text-white"
                  : "border-border text-text-secondary hover:text-text-primary hover:border-text-muted"
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>

      <div className="border border-border bg-surface">
        <div className="grid grid-cols-[1fr_120px_90px_100px_24px] gap-4 px-5 py-3 border-b border-border text-[10px] small-caps text-text-muted">
          <div>Prompt</div>
          <div>Context</div>
          <div>Score</div>
          <div>Date</div>
          <div />
        </div>
        {rows.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-text-muted">No generations yet.</div>
        )}
        {rows.map((g) => (
          <Row key={g.id} g={g} open={expanded === g.id} onToggle={() => setExpanded(expanded === g.id ? null : g.id)} />
        ))}
      </div>
    </div>
  );
}

function Row({ g, open, onToggle }: { g: Generation; open: boolean; onToggle: () => void }) {
  const c =
    g.score.overall >= 0.75 ? "bg-success/15 text-success border-success/30" :
    g.score.overall >= 0.5 ? "bg-warning/15 text-warning border-warning/30" :
    "bg-danger/15 text-danger border-danger/30";

  return (
    <>
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-[1fr_120px_90px_100px_24px] gap-4 px-5 py-3 border-b border-border text-left hover:bg-surface-elevated transition-colors items-center"
      >
        <div className="text-sm text-text-primary truncate">
          {g.prompt.slice(0, 60)}{g.prompt.length > 60 ? "…" : ""}
        </div>
        <div className="text-xs text-text-secondary">{g.context}</div>
        <div>
          <span className={`font-mono text-xs px-2 py-0.5 rounded-sm border ${c}`}>
            {g.score.overall.toFixed(3)}
          </span>
        </div>
        <div className="font-mono text-xs text-text-muted">{g.date}</div>
        <div className="text-text-muted">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </div>
      </button>
      {open && (
        <div className="px-5 py-5 border-b border-border bg-background">
          <div className="border border-border bg-surface mb-4">
            <pre className="font-mono text-sm text-text-primary p-4 whitespace-pre-wrap leading-relaxed">
              {g.output}
            </pre>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { k: "Embedding", v: g.score.embedding },
              { k: "Programmatic", v: g.score.programmatic },
              { k: "LLM Judge", v: g.score.llm_judge },
            ].map((r) => (
              <div key={r.k}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-text-secondary">{r.k}</span>
                  <span className="font-mono text-text-primary">{(r.v * 100).toFixed(0)}%</span>
                </div>
                <div className="h-1 bg-surface-elevated">
                  <div className="h-full bg-indigo" style={{ width: `${r.v * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-secondary italic">{g.score.reasoning}</p>
        </div>
      )}
    </>
  );
}
