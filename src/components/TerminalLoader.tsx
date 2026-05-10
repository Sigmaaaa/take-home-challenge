import { useEffect, useMemo, useState } from "react";

interface Props {
  lines: string[];
  charCount: number;
  apiDone: boolean;
  onDone?: () => void;
}

const WAITING_MESSAGES = [
  "Cross-referencing patterns...",
  "Validating style hierarchy...",
  "Finalizing fingerprint...",
];

export function TerminalLoader({ lines, charCount, apiDone, onDone }: Props) {
  const lineInterval = useMemo(() => {
    const estimatedSeconds = Math.max(18, Math.floor(charCount / 2500));
    return Math.floor((estimatedSeconds * 0.8 * 1000) / lines.length);
  }, [charCount, lines.length]);

  const [shown, setShown] = useState(0);
  const [animationDone, setAnimationDone] = useState(false);
  const [waitIdx, setWaitIdx] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (shown >= lines.length - 1) {
      setAnimationDone(true);
      return;
    }
    const t = setTimeout(() => setShown((s) => s + 1), lineInterval);
    return () => clearTimeout(t);
  }, [shown, lines.length, lineInterval]);

  // Cycle waiting messages while animation done but API not done
  useEffect(() => {
    if (!animationDone || apiDone) return;
    const t = setInterval(() => {
      setWaitIdx((i) => (i + 1) % WAITING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(t);
  }, [animationDone, apiDone]);

  useEffect(() => {
    if (!(animationDone && apiDone)) return;
    setShowCompletion(true);
    const t1 = setTimeout(() => setFadeOut(true), 600);
    const t2 = setTimeout(() => onDone?.(), 600 + 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [animationDone, apiDone, onDone]);

  const waitingForApi = animationDone && !apiDone;

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex items-start justify-center pt-[20vh] px-6 transition-opacity duration-[500ms]"
      style={{ opacity: fadeOut ? 0 : 1 }}
    >
      <div className="absolute top-4 left-5 font-mono text-[11px] small-caps text-text-muted">
        Tone &amp; Style
      </div>
      <div className="w-full max-w-[680px] font-mono text-sm leading-relaxed">
        {lines.slice(0, shown + 1).map((line, i) => {
          const isActive = i === shown && !animationDone;
          return (
            <div
              key={i}
              className={isActive ? "text-text-primary blink-cursor" : "text-text-muted"}
            >
              <span className="text-indigo mr-2">›</span>
              {line}
            </div>
          );
        })}
        {waitingForApi && (
          <div key={waitIdx} className="text-indigo blink-cursor mt-1">
            <span className="mr-2">›</span>{WAITING_MESSAGES[waitIdx]}
          </div>
        )}
        {showCompletion && (
          <div className="text-indigo mt-1">
            <span className="mr-2">›</span>Analysis complete. Building your profile...
          </div>
        )}
      </div>
    </div>
  );
}
