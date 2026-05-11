import { useEffect, useState } from "react";

const STORAGE_KEY = "welcome_modal_seen_v1";

const STEPS = [
  {
    title: "Welcome to Tone & Style.",
    body: "Upload any writing corpus and we extract a psycholinguistic style fingerprint. Then generate new text that authentically matches that person's voice.",
  },
  {
    title: "Try the demo.",
    body: "Reza Corpus v1 is already loaded in the sidebar. Click it to see a real extracted style profile across 276 messages spanning WhatsApp, Slack, and email.",
  },
  {
    title: "Generate and score.",
    body: "Go to Generate, enter any prompt, and see text written in that person's voice. A three-layer scorer tells you how well it matched.",
  },
];

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {}
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setOpen(false);
  };

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-md border border-border bg-surface p-7 rounded-none shadow-2xl">
        <div className="text-[10px] small-caps text-text-muted mb-3 font-mono">
          Step {step + 1} of {STEPS.length}
        </div>
        <h2 className="text-xl text-text-primary text-tight leading-tight">
          {current.title}
        </h2>
        <p className="mt-3 text-sm text-text-secondary leading-relaxed">
          {current.body}
        </p>

        <div className="mt-7 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-xs px-3 py-2 border border-border text-text-secondary hover:text-text-primary hover:border-indigo rounded-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-text-secondary"
          >
            Back
          </button>

          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full transition-colors ${
                  i === step ? "bg-indigo" : "bg-border"
                }`}
              />
            ))}
          </div>

          {isLast ? (
            <button
              onClick={dismiss}
              className="text-xs px-3 py-2 bg-indigo hover:bg-indigo-hover text-white rounded-sm transition-colors"
            >
              Start Exploring →
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="text-xs px-3 py-2 bg-indigo hover:bg-indigo-hover text-white rounded-sm transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
