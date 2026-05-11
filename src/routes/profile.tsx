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

  const meta = (root as any)?.extraction_metadata as any;
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

      <Section title="Global" defaultOpen low={isLow("global")}>
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
        <ChipsRow label="Primary Contexts" items={arr(g.primary_contexts)} tag low={isLow("primary_contexts")} />
        <KVNode label="Language Mixing" low={isLow("language_mixing")}>
          <YesNoBadge value={g.language_mixing} />
        </KVNode>
        <KV label="Length Variance" value={g.length_variance} low={isLow("length_variance")} />
      </Section>

      <Section title="Mid-Level" low={isLow("mid_level")}>
        <KV label="Sentence Rhythm" value={p.sentence_rhythm} low={isLow("sentence_rhythm")} />
        <KV label="Avg Sentences / Message" value={m.avg_sentences_per_message != null ? String(m.avg_sentences_per_message) : null} mono low={isLow("avg_sentences_per_message")} />
        <KV label="Question Frequency" value={p.question_frequency} mono low={isLow("question_frequency")} />
        <KV label="Paragraph Structure" value={m.paragraph_structure} low={isLow("paragraph_structure")} />
        <KV label="Context Switching" value={m.context_switching} low={isLow("context_switching")} />
        <KVNode label="Uses Bullet Points" low={isLow("uses_bullet_points")}>
          <YesNoBadge value={m.uses_bullet_points} />
        </KVNode>
        <KVNode label="Uses Numbered Lists" low={isLow("uses_numbered_lists")}>
          <YesNoBadge value={m.uses_numbered_lists} />
        </KVNode>
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

        <ChipsRow label="Filler Phrases" items={arr(get(p, "filler_phrases", "examples"))} low={isLow("filler_phrases")} />

        <div className="py-3 border-b border-border">
          <div className="text-[10px] small-caps text-text-muted mb-2">Hedging Language{isLow("hedging_language") && <LowMark />}</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {arr(get(p, "hedging_language", "examples")).map((e) => <Chip key={e}>{e}</Chip>)}
          </div>
          {get(p, "hedging_language", "pattern") && (
            <p className="text-xs text-text-secondary italic">{get(p, "hedging_language", "pattern")}</p>
          )}
        </div>

        <div className="py-3 border-b border-border">
          <div className="text-[10px] small-caps text-text-muted mb-3">Pronoun Ratio{isLow("pronoun_ratio") && <LowMark />}</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {([["I", pron.I_frequency], ["you", pron.you_frequency], ["we", pron.we_frequency]] as const).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="font-mono text-xs text-text-secondary">{k}</span>
                <PronounBadge level={typeof v === "string" ? v : ""} />
              </div>
            ))}
          </div>
        </div>

        <KV label="Exclamation Frequency" value={l.exclamation_frequency} low={isLow("exclamation_frequency")} />
        <KV label="Question Mark Style" value={l.question_mark_style} low={isLow("question_mark_style")} />
        <KV label="Period Usage" value={l.period_usage} low={isLow("period_usage")} />
        <KV label="Capitalization" value={l.capitalization} low={isLow("capitalization")} />
        <KV label="Typo Tolerance" value={l.typo_tolerance} low={isLow("typo_tolerance")} />
        <ChipsRow label="Typo Patterns" items={arr(l.typo_patterns)} low={isLow("typo_patterns")} />

        <div className="py-3 border-b border-border">
          <div className="text-[10px] small-caps text-text-muted mb-2">Intensifiers{isLow("intensifiers") && <LowMark />}</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {arr(get(l, "intensifiers", "examples")).map((e) => <Chip key={e}>{e}</Chip>)}
          </div>
          {get(l, "intensifiers", "pattern") && (
            <p className="text-xs text-text-secondary italic">{get(l, "intensifiers", "pattern")}</p>
          )}
        </div>

        <div className="py-3 border-b border-border">
          <div className="text-[10px] small-caps text-text-muted mb-2">Warmth Markers{isLow("warmth_markers") && <LowMark />}</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {arr(get(l, "warmth_markers", "examples")).map((e) => <Chip key={e}>{e}</Chip>)}
          </div>
          {get(l, "warmth_markers", "pattern") && (
            <p className="text-xs text-text-secondary italic">{get(l, "warmth_markers", "pattern")}</p>
          )}
        </div>

        <div className="py-3">
          <div className="text-[10px] small-caps text-text-muted mb-2">Sign-offs{isLow("sign_offs") && <LowMark />}</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {arr(get(p, "sign_offs", "examples")).map((e) => <Chip key={e}>{e}</Chip>)}
          </div>
          {get(p, "sign_offs", "pattern") && (
            <p className="text-xs text-text-secondary italic">{get(p, "sign_offs", "pattern")}</p>
          )}
        </div>
      </Section>

      <Section title="Register Shifts">
        <ChipsRow label="Formal Triggers" items={arr(get(root, "register_shifts", "formal_triggers"))} low={isLow("formal_triggers")} />
        <ChipsRow label="Casual Triggers" items={arr(get(root, "register_shifts", "casual_triggers"))} low={isLow("casual_triggers")} />
        <KV label="Shift Smoothness" value={get(root, "register_shifts", "shift_smoothness")} low={isLow("shift_smoothness")} />
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

      {meta && (
        <div className="mt-4 border border-border bg-surface p-5">
          <div className="text-[10px] small-caps text-text-muted mb-2">Extraction Notes</div>
          {meta.extraction_notes && (
            <p className="text-xs text-text-secondary leading-relaxed mb-3">{meta.extraction_notes}</p>
          )}
          {lowDims.length > 0 && (
            <div>
              <div className="text-[11px] font-mono text-warning mb-2">~{lowDims.length} dimensions flagged as low confidence:</div>
              <div className="flex flex-wrap gap-1.5">
                {lowDims.map((d) => (
                  <span key={d} className="inline-block font-mono text-[11px] px-2 py-0.5 border border-warning/40 bg-warning/10 text-warning rounded-sm">
                    ~{d}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PronounBadge({ level }: { level: string }) {
  const l = (level || "").toLowerCase();
  const label = l === "moderate" ? "MED" : l === "high" ? "HIGH" : l === "low" ? "LOW" : "—";
  const cls =
    l === "high"
      ? "bg-indigo border-indigo text-white"
      : l === "moderate"
      ? "border-indigo text-indigo bg-transparent"
      : "border-border text-text-muted bg-transparent";
  return (
    <span className={`inline-block font-mono text-[10px] px-2 py-0.5 border rounded-sm ${cls}`}>
      {label}
    </span>
  );
}

function Section({ title, children, defaultOpen = false, low = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean; low?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border bg-surface mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-surface-elevated transition-colors"
      >
        <span className="text-sm text-text-primary text-tight">{title}{low && <LowMark />}</span>
        {open ? <ChevronDown className="size-4 text-text-muted" /> : <ChevronRight className="size-4 text-text-muted" />}
      </button>
      {open && <div className="px-5 pb-4 border-t border-border">{children}</div>}
    </div>
  );
}

function LowMark() {
  return (
    <sup
      className="ml-1 cursor-help font-mono text-[10px] align-super"
      style={{ color: "#F59E0B" }}
      title="Limited evidence in corpus — may not be reliable."
    >
      ~
    </sup>
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

function KVNode({ label, low, children }: { label: string; low?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 py-2.5 border-b border-border last:border-b-0 items-center">
      <div className="text-[10px] small-caps text-text-muted">{label}{low && <LowMark />}</div>
      <div>{children}</div>
    </div>
  );
}

function YesNoBadge({ value }: { value: any }) {
  const yes = value === true;
  const no = value === false;
  if (!yes && !no) return <span className="text-text-muted text-xs">—</span>;
  const cls = yes
    ? "bg-indigo border-indigo text-white"
    : "border-border text-text-muted bg-transparent";
  return (
    <span className={`inline-block font-mono text-[10px] px-2 py-0.5 border rounded-sm ${cls}`}>
      {yes ? "YES" : "NO"}
    </span>
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
