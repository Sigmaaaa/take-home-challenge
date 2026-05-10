import { useEffect, useState } from "react";

interface Props {
  lines: string[];
  intervalMs?: number;
  apiDone: boolean;
  onDone?: () => void;
}

export function TerminalLoader({ lines, intervalMs = 1500, apiDone, onDone }: Props) {
  const [shown, setShown] = useState(0);
  const [animationDone, setAnimationDone] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // Advance lines on cadence
  useEffect(() => {
    if (shown >= lines.length - 1) {
      setAnimationDone(true);
      return;
    }
    const t = setTimeout(() => setShown((s) => s + 1), intervalMs);
    return () => clearTimeout(t);
  }, [shown, lines.length, intervalMs]);

  // When both finished, show completion line, then fade
  useEffect(() => {
    if (!(animationDone && apiDone)) return;
    setShowCompletion(true);
    const t1 = setTimeout(() => setFadeOut(true), 600);
    const t2 = setTimeout(() => onDone?.(), 600 + 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [animationDone, apiDone, onDone]);

  const waitingForApi = animationDone && !apiDone;

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex items-start justify-center pt-[20vh] px-6 transition-opacity duration-[400ms]"
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
          <div className="text-text-primary blink-cursor">
            <span className="text-indigo mr-2">›</span>
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
