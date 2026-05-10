import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DeleteGenerationButton } from "@/components/DeleteGenerationButton";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      { title: "Generation History — Tone & Style" },
      { name: "description", content: "Past generations and their style match scores." },
    ],
  }),
});

interface GenRow {
  id: string;
  prompt: string;
  context_type: string | null;
  output_text?: string | null;
  output?: string | null;
  score: any;
  created_at: string;
  style_profile?: { corpus?: { name?: string | null } | null } | null;
}

function HistoryPage() {
  const [filter, setFilter] = useState<string>("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: rows = [], isLoading, error } = useQuery<GenRow[]>({
    queryKey: ["history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generations")
        .select("*, style_profile:style_profiles(corpus:corpora(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GenRow[];
    },
  });

  const shortLabel = (ct: string) => {
    const s = ct.toLowerCase();
    if (s.includes("email")) return "Email";
    if (s.includes("slack")) return "Slack";
    if (s.includes("whatsapp") || s.includes("text")) return "Text";
    return ct.length > 12 ? ct.slice(0, 12) + "…" : ct;
  };
  const rawTypes = Array.from(new Set(rows.map((r) => r.context_type).filter(Boolean) as string[]));
  const labelMap = new Map<string, string[]>();
  rawTypes.forEach((ct) => {
    const lbl = shortLabel(ct);
    labelMap.set(lbl, [...(labelMap.get(lbl) ?? []), ct]);
  });
  const filters = ["All", ...labelMap.keys()];
  const filtered = rows.filter(
    (g) => filter === "All" || (g.context_type && labelMap.get(filter)?.includes(g.context_type)),
  );

  return (
    <div className="pb-20">
      <h1 className="text-[28px] text-tighter text-text-primary mb-6">Generation History</h1>

      <div className="flex gap-2 mb-5 flex-wrap">
        {filters.map((f) => {
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

      {error && (
        <div className="mb-4 border border-danger/50 bg-danger/10 text-danger text-xs px-3 py-2 rounded-sm font-mono">
          {(error as Error).message}
        </div>
      )}

      <div className="border border-border bg-surface">
        <div className="grid grid-cols-[24px_1fr_120px_90px_100px_24px] gap-4 px-5 py-3 border-b border-border text-[10px] small-caps text-text-muted">
          <div />
          <div>Prompt</div>
          <div>Context</div>
          <div>Score</div>
          <div>Date</div>
          <div />
        </div>
        {isLoading && <div className="px-5 py-8 text-center text-sm text-text-muted">Loading…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-text-muted">No generations yet.</div>
        )}
        {filtered.map((g) => (
          <Row key={g.id} g={g} open={expanded === g.id} onToggle={() => setExpanded(expanded === g.id ? null : g.id)} />
        ))}
      </div>
    </div>
  );
}

function Row({ g, open, onToggle }: { g: GenRow; open: boolean; onToggle: () => void }) {
  const overall = Number(g.score?.overall_score ?? g.score?.overall ?? 0);
  const c =
    overall >= 0.75 ? "bg-success/15 text-success border-success/30" :
    overall >= 0.5 ? "bg-warning/15 text-warning border-warning/30" :
    "bg-danger/15 text-danger border-danger/30";
  const date = g.created_at ? new Date(g.created_at).toISOString().slice(0, 10) : "";
  const output = g.output_text ?? g.output ?? "";
  const embed = Number(g.score?.style_embedding?.score ?? 0);
  const prog = Number(g.score?.programmatic?.score ?? 0);
  const judge = Number(g.score?.llm_judge?.score ?? 0);
  const reasoning = g.score?.llm_judge?.reasoning ?? g.score?.reasoning ?? "";

  return (
    <>
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        className="group w-full grid grid-cols-[24px_1fr_120px_90px_100px_24px] gap-4 px-5 py-3 border-b border-border text-left hover:bg-surface-elevated transition-colors items-center cursor-pointer"
      >
        <DeleteGenerationButton generationId={g.id} />
        <div className="text-sm text-text-primary truncate">
          {g.prompt.slice(0, 80)}{g.prompt.length > 80 ? "…" : ""}
        </div>
        <div className="text-xs text-text-secondary">{g.context_type || "—"}</div>
        <div>
          <span className={`font-mono text-xs px-2 py-0.5 rounded-sm border ${c}`}>
            {overall.toFixed(3)}
          </span>
        </div>
        <div className="font-mono text-xs text-text-muted">{date}</div>
        <div className="text-text-muted">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </div>
      </div>
      {open && (
        <div className="px-5 py-5 border-b border-border bg-background space-y-5">
          <div>
            <div className="text-[10px] small-caps text-text-muted mb-2">Prompt</div>
            <div
              className="border-l-[3px] border-indigo bg-[#1A1A1A] px-4 py-3 italic text-sm text-text-secondary whitespace-pre-wrap leading-relaxed"
            >
              {g.prompt}
            </div>
          </div>
          <div>
            <div className="text-[10px] small-caps text-text-muted mb-2">Output</div>
            <div className="border border-border bg-surface">
              <pre className="font-mono text-sm text-text-primary p-4 whitespace-pre-wrap leading-relaxed">{output}</pre>
            </div>
          </div>
          <div>
            <div className="text-[10px] small-caps text-text-muted mb-2">Score Breakdown</div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { k: "Embedding", v: embed },
                { k: "Programmatic", v: prog },
                { k: "LLM Judge", v: judge },
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
            {reasoning && <p className="text-xs text-text-secondary italic">{reasoning}</p>}
          </div>
        </div>
      )}
    </>
  );
}
