import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { DeleteCorpusButton } from "@/components/DeleteCorpusButton";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "Style Profile — Tone & Style" },
      { name: "description", content: "Psycholinguistic profile extracted from a writing corpus." },
    ],
  }),
});

function ProfilePage() {
  const { activeCorpusId } = useStore();

  const { data, isLoading, error } = useQuery({
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

  if (!activeCorpusId) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary text-sm mb-4">No corpus selected.</p>
        <Link to="/" className="text-indigo text-sm">Analyze one →</Link>
      </div>
    );
  }
  if (isLoading) return <div className="text-text-secondary text-sm py-10">Loading profile…</div>;
  if (error) return <div className="text-danger text-sm py-10">{(error as Error).message}</div>;
  if (!data?.corpus) return <div className="text-text-secondary text-sm py-10">Corpus not found.</div>;
  if (!data.profile) return (
    <div className="text-text-secondary text-sm py-10">
      No style profile yet for this corpus. <Link to="/" className="text-indigo">Analyze again →</Link>
    </div>
  );

  const c = data.corpus;
  const root = (data.profile?.profile ?? data.profile) as any;
  const g = root?.global ?? {};
  const m = root?.mid_level ?? {};
  const l = root?.local ?? {};
  const p = { ...g, ...m, ...l } as any;

  // Defensive accessors — schema is JSON-ish per spec
  const get = (obj: any, ...keys: string[]) => keys.reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
  const arr = (v: any): string[] => Array.isArray(v) ? v.filter((x) => typeof x === "string" || typeof x === "number").map(String) : [];

  const formality = Number(g.formality_score ?? 0);
  const cog = root?.cognitive_spike ?? {};
  const pron = l.pronoun_ratio ?? {};
  const pronI = Number(pron.I ?? pron.i ?? pron.first_person ?? 0);
  const pronYou = Number(pron.you ?? pron.second_person ?? 0);
  const pronWe = Number(pron.we ?? pron.first_person_plural ?? 0);

  const dateStr = c.created_at ? new Date(c.created_at).toISOString().slice(0, 10) : "";

  const meta = data.profile?.extraction_metadata as any;
  const confidence = meta?.data_confidence as "low" | "medium" | "high" | undefined;
  const lowDims: string[] = Array.isArray(meta?.low_confidence_dimensions) ? meta.low_confidence_dimensions : [];
  const isLow = (key: string) => lowDims.includes(key);

  return (
    <div className="pb-20 animate-[fadeIn_400ms_ease-out_both]">
      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
      <header className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-[32px] text-tighter text-text-primary leading-[1.1]">{c.name}</h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.source_type && <Pill>{c.source_type}</Pill>}
            {c.language && <Pill>{c.language}</Pill>}
            {c.source_label && <Pill>{c.source_label}</Pill>}
            {dateStr && <Pill>analyzed {dateStr}</Pill>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DeleteCorpusButton corpusId={c.id} corpusName={c.name} variant="button" />
          <Link
            to="/generate"
            className="bg-indigo hover:bg-indigo-hover hover:shadow-[0_0_0_3px_color-mix(in_oklab,var(--indigo)_25%,transparent)] text-white text-sm py-2 px-4 rounded-sm"
          >
            Generate Text →
          </Link>
        </div>
      </header>

      {confidence === "low" && (
        <div className="mb-6 border border-warning/50 bg-warning/10 text-warning text-xs px-4 py-3 rounded-sm font-mono">
          ⚠ Low data confidence — profile based on limited writing samples. Patterns marked ~ may not be reliable. Add more writing for a stronger fingerprint.
        </div>
      )}
      {confidence === "medium" && (
        <div className="mb-6 border border-border bg-surface text-text-muted text-xs px-4 py-3 rounded-sm font-mono">
          ○ Medium confidence — some dimensions may improve with more samples.
        </div>
      )}

      <Section title="Global" defaultOpen>
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] small-caps text-text-muted">Formality Score{isLow("formality_score") && <LowMark />}</span>
            <span className="font-mono text-sm text-text-primary">{formality.toFixed(2)}</span>
          </div>
          <Bar value={formality} />
        </div>
        <KV label="Register" value={p.register} low={isLow("register")} />
        <KV label="Avg Message Length" value={p.avg_message_length} mono low={isLow("avg_message_length")} />
        <KV label="Overall Tone" value={p.overall_tone} low={isLow("overall_tone")} />
        <KV label="Social Orientation" value={p.social_orientation} low={isLow("social_orientation")} />
        <KV label="Politeness Strategy" value={p.politeness_strategy} low={isLow("politeness_strategy")} />
      </Section>

      <Section title="Mid-Level">
        <KV label="Sentence Rhythm" value={p.sentence_rhythm} low={isLow("sentence_rhythm")} />
        <KV label="Question Frequency" value={p.question_frequency} mono low={isLow("question_frequency")} />
        <ChipsRow label="Structural Habits" items={arr(p.structural_habits)} tag low={isLow("structural_habits")} />
        <KV label="Information Structure" value={p.information_structure} low={isLow("information_structure")} />
        <KV label="Follow-up Behavior" value={p.follow_up_behavior} low={isLow("follow_up_behavior")} />

        <div className="py-3 border-b border-border">
          <div className="text-[10px] small-caps text-text-muted mb-2">Openers{isLow("opener_patterns") && <LowMark />}</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {arr(get(p, "opener_patterns", "examples")).map((e) => <Chip key={e}>{e}</Chip>)}
          </div>
          {get(p, "opener_patterns", "pattern") && (
            <p className="text-xs text-text-secondary italic">{get(p, "opener_patterns", "pattern")}</p>
          )}
        </div>

        <div className="py-3">
          <div className="text-[10px] small-caps text-text-muted mb-2">Closers{isLow("closer_patterns") && <LowMark />}</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {arr(get(p, "closer_patterns", "examples")).map((e) => <Chip key={e}>{e}</Chip>)}
          </div>
          {get(p, "closer_patterns", "pattern") && (
            <p className="text-xs text-text-secondary italic">{get(p, "closer_patterns", "pattern")}</p>
          )}
        </div>
      </Section>

      <Section title="Local">
        <div className="py-3 border-b border-border">
          <div className="text-[10px] small-caps text-text-muted mb-2">Emoji Usage{(isLow("emoji_usage") || isLow("emoji_style")) && <LowMark />}</div>
          {p.emoji_usage && <p className="text-sm text-text-primary mb-2">{p.emoji_usage}</p>}
          <div className="flex flex-wrap gap-2 text-xl">
            {arr(get(p, "emoji_style", "examples")).map((e, i) => (
              <span key={i} className="px-2 py-1 border border-border rounded-sm bg-background text-base">{e}</span>
            ))}
          </div>
        </div>

        <div className="py-3 border-b border-border">
          <div className="text-[10px] small-caps text-text-muted mb-2">Prosodic Compensation{isLow("prosodic_compensation") && <LowMark />}</div>
          <div className="flex flex-wrap gap-1.5">
            {arr(get(p, "prosodic_compensation", "letter_repetition", "examples")).map((e) => (
              <Chip key={e}>{e}</Chip>
            ))}
          </div>
        </div>

        <ChipsRow label="Filler Phrases" items={arr(get(p, "filler_phrases", "examples"))} />

        <div className="py-3 border-b border-border">
          <div className="text-[10px] small-caps text-text-muted mb-2">Hedging Language</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {arr(get(p, "hedging_language", "examples")).map((e) => <Chip key={e}>{e}</Chip>)}
          </div>
          {get(p, "hedging_language", "pattern") && (
            <p className="text-xs text-text-secondary italic">{get(p, "hedging_language", "pattern")}</p>
          )}
        </div>

        <div className="py-3 border-b border-border">
          <div className="text-[10px] small-caps text-text-muted mb-3">Pronoun Ratio</div>
          <div className="grid grid-cols-3 gap-3">
            {([["I", pronI], ["you", pronYou], ["we", pronWe]] as const).map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between mb-1">
                  <span className="font-mono text-xs text-text-secondary">{k}</span>
                  <span className="font-mono text-xs text-text-primary">{(v * 100).toFixed(0)}%</span>
                </div>
                <Bar value={v} />
              </div>
            ))}
          </div>
        </div>

        <div className="py-3">
          <div className="text-[10px] small-caps text-text-muted mb-2">Sign-offs</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {arr(get(p, "sign_offs", "examples")).map((e) => <Chip key={e}>{e}</Chip>)}
          </div>
          {get(p, "sign_offs", "pattern") && (
            <p className="text-xs text-text-secondary italic">{get(p, "sign_offs", "pattern")}</p>
          )}
        </div>
      </Section>

      <div className="mt-8 border border-border border-l-[3px] border-l-indigo bg-surface-elevated p-7">
        <div className="text-[11px] small-caps text-indigo mb-5">Cognitive Signature</div>
        <div className="space-y-5">
          {[
            { k: "COARSE", v: cog.coarse_signal },
            { k: "MID", v: cog.mid_signal },
            { k: "FINE", v: cog.fine_signal },
          ].map((row) => (
            <div key={row.k}>
              <div className="font-mono text-[10px] text-text-muted mb-1.5 tracking-wider">{row.k}</div>
              <p className="text-[15px] leading-relaxed text-text-primary">{row.v || "—"}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border bg-surface mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-surface-elevated transition-colors"
      >
        <span className="text-sm text-text-primary text-tight">{title}</span>
        {open ? <ChevronDown className="size-4 text-text-muted" /> : <ChevronRight className="size-4 text-text-muted" />}
      </button>
      {open && <div className="px-5 pb-4 border-t border-border">{children}</div>}
    </div>
  );
}

function LowMark() {
  return (
    <span
      className="ml-1 text-warning cursor-help"
      title="Limited evidence in corpus — may not be reliable."
    >
      ~
    </span>
  );
}

function KV({ label, value, mono, low }: { label: string; value?: string | null; mono?: boolean; low?: boolean }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 py-2.5 border-b border-border last:border-b-0">
      <div className="text-[10px] small-caps text-text-muted pt-0.5">{label}{low && <LowMark />}</div>
      <div className={`text-sm text-text-primary ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1 bg-surface-elevated overflow-hidden rounded-sm">
      <div className="h-full bg-indigo" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-[10px] small-caps px-2 py-0.5 border border-border rounded-sm text-text-secondary">
      {children}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block font-mono text-xs px-2 py-1 border border-border rounded-sm text-text-primary bg-background">
      {children}
    </span>
  );
}

function ChipsRow({ label, items, tag = false, low }: { label: string; items: string[]; tag?: boolean; low?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="py-3 border-b border-border">
      <div className="text-[10px] small-caps text-text-muted mb-2">{label}{low && <LowMark />}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => tag ? (
          <span key={i} className="inline-block text-xs px-2 py-1 border border-border rounded-sm text-text-primary bg-surface-elevated">{i}</span>
        ) : (
          <Chip key={i}>{i}</Chip>
        ))}
      </div>
    </div>
  );
}
