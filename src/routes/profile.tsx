import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";

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
  const { corpora, activeCorpusId } = useStore();
  const corpus = corpora.find((c) => c.id === activeCorpusId) ?? corpora[0];

  if (!corpus) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary text-sm mb-4">No corpus loaded.</p>
        <Link to="/" className="text-indigo text-sm">Analyze one →</Link>
      </div>
    );
  }

  const p = corpus.profile;

  return (
    <div className="pb-20">
      <header className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-[32px] text-tighter text-text-primary leading-[1.1]">{corpus.name}</h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill>{corpus.source_type}</Pill>
            <Pill>{corpus.message_count} msgs</Pill>
            <Pill>{corpus.char_count.toLocaleString()} chars</Pill>
            <Pill>{corpus.language}</Pill>
            <Pill>analyzed {corpus.date_analyzed}</Pill>
          </div>
        </div>
        <Link
          to="/generate"
          className="shrink-0 bg-indigo hover:bg-indigo/90 text-white text-sm py-2 px-4 rounded-sm"
        >
          Generate Text →
        </Link>
      </header>

      <Section title="Global" defaultOpen>
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] small-caps text-text-muted">Formality Score</span>
            <span className="font-mono text-sm text-text-primary">{p.global.formality.toFixed(2)}</span>
          </div>
          <Bar value={p.global.formality} />
        </div>
        <KV label="Register" value={p.global.register} />
        <KV label="Avg Message Length" value={p.global.avg_message_length} mono />
        <KV label="Overall Tone" value={p.global.overall_tone} />
        <KV label="Social Orientation" value={p.global.social_orientation} />
        <KV label="Politeness Strategy" value={p.global.politeness_strategy} />
      </Section>

      <Section title="Mid-Level">
        <KV label="Sentence Rhythm" value={p.mid.sentence_rhythm} />
        <KV label="Question Frequency" value={p.mid.question_frequency} mono />
        <div className="py-2.5 border-b border-border">
          <div className="text-[10px] small-caps text-text-muted mb-2">Structural Habits</div>
          <div className="flex flex-wrap gap-1.5">
            {p.mid.structural_habits.map((h) => <Tag key={h}>{h}</Tag>)}
          </div>
        </div>
        <KV label="Information Structure" value={p.mid.information_structure} />
        <KV label="Follow-up Behavior" value={p.mid.follow_up_behavior} />
        <KV label="Social Maintenance" value={p.mid.social_maintenance} />

        <div className="py-3 border-b border-border">
          <div className="text-[10px] small-caps text-text-muted mb-2">Openers</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {p.mid.opener_examples.map((e) => <Chip key={e}>{e}</Chip>)}
          </div>
          <p className="text-xs text-text-secondary italic">{p.mid.opener_pattern}</p>
        </div>

        <div className="py-3">
          <div className="text-[10px] small-caps text-text-muted mb-2">Closers</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {p.mid.closer_examples.map((e) => <Chip key={e}>{e}</Chip>)}
          </div>
          <p className="text-xs text-text-secondary italic">{p.mid.closer_pattern}</p>
        </div>
      </Section>

      <Section title="Local">
        <div className="py-3 border-b border-border">
          <div className="text-[10px] small-caps text-text-muted mb-2">Emoji Usage</div>
          <p className="text-sm text-text-primary mb-2">{p.local.emoji_usage}</p>
          <div className="flex gap-2 text-xl">
            {p.local.emoji_examples.map((e, i) => <span key={i}>{e}</span>)}
          </div>
        </div>

        <div className="py-3 border-b border-border">
          <div className="text-[10px] small-caps text-text-muted mb-2">Prosodic Compensation</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {p.local.letter_repetition.map((e) => <Chip key={e}>{e}</Chip>)}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {p.local.punctuation_stacking.map((e) => <Chip key={e}>{e}</Chip>)}
          </div>
        </div>

        <ChipsRow label="Filler Phrases" items={p.local.filler_phrases} />
        <ChipsRow label="Hedging Language" items={p.local.hedging} />
        <ChipsRow label="Intensifiers" items={p.local.intensifiers} />

        <div className="py-3 border-b border-border">
          <div className="text-[10px] small-caps text-text-muted mb-3">Pronoun Ratio</div>
          <div className="grid grid-cols-3 gap-3">
            {(["I", "you", "we"] as const).map((k) => (
              <div key={k}>
                <div className="flex justify-between mb-1">
                  <span className="font-mono text-xs text-text-secondary">{k}</span>
                  <span className="font-mono text-xs text-text-primary">
                    {(p.local.pronoun_ratio[k] * 100).toFixed(0)}%
                  </span>
                </div>
                <Bar value={p.local.pronoun_ratio[k]} />
              </div>
            ))}
          </div>
        </div>

        <div className="py-3">
          <div className="text-[10px] small-caps text-text-muted mb-2">Sign-offs</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {p.local.signoffs.map((e) => <Chip key={e}>{e}</Chip>)}
          </div>
          <p className="text-xs text-text-secondary italic">{p.local.signoff_pattern}</p>
        </div>
      </Section>

      {/* Cognitive Signature */}
      <div className="mt-8 border border-border border-l-[3px] border-l-indigo bg-surface-elevated p-7">
        <div className="text-[11px] small-caps text-indigo mb-5">Cognitive Signature</div>
        <div className="space-y-5">
          {[
            { k: "COARSE", v: p.cognitive.coarse },
            { k: "MID", v: p.cognitive.mid },
            { k: "FINE", v: p.cognitive.fine },
          ].map((row) => (
            <div key={row.k}>
              <div className="font-mono text-[10px] text-text-muted mb-1.5 tracking-wider">{row.k}</div>
              <p className="text-[15px] leading-relaxed text-text-primary">{row.v}</p>
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

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 py-2.5 border-b border-border last:border-b-0">
      <div className="text-[10px] small-caps text-text-muted pt-0.5">{label}</div>
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

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-xs px-2 py-1 border border-border rounded-sm text-text-primary bg-surface-elevated">
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

function ChipsRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="py-3 border-b border-border">
      <div className="text-[10px] small-caps text-text-muted mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => <Chip key={i}>{i}</Chip>)}
      </div>
    </div>
  );
}
