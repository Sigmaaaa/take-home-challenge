import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  lines: string[];
  charCount: number;
  apiDone: boolean;
  onDone?: () => void;
}

function elapsedMessage(secs: number): string {
  const s = Math.max(2, secs);
  if (secs <= 5) return `${s}s — warming up the neurons...`;
  if (secs <= 10) return `${s}s — reading between the lines...`;
  if (secs <= 15) return `${s}s — your writing has layers...`;
  if (secs <= 20) return `${s}s — this one's complex (good sign)...`;
  if (secs <= 25) return `${s}s — detecting your personality...`;
  if (secs <= 30) return `${s}s — almost crystallized...`;
  if (secs <= 35) return `${s}s — worth the wait, promise...`;
  return `${s}s — any second now...`;
}

export function TerminalLoader({ lines, charCount, apiDone, onDone }: Props) {
  const lineInterval = useMemo(() => {
    const estimatedSeconds = Math.max(28, Math.floor(charCount / 1500));
    return Math.floor((estimatedSeconds * 0.75 * 1000) / 9);
  }, [charCount]);

  const [shown, setShown] = useState(0);
  const [animationDone, setAnimationDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (shown >= lines.length - 1) {
      setAnimationDone(true);
      return;
    }
    const t = setTimeout(() => setShown((s) => s + 1), lineInterval);
    return () => clearTimeout(t);
  }, [shown, lines.length, lineInterval]);

  // Tick elapsed seconds while waiting for API
  useEffect(() => {
    if (!animationDone || apiDone) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [animationDone, apiDone]);

  useEffect(() => {
    if (!(animationDone && apiDone)) return;
    setShowCompletion(true);
    const t1 = setTimeout(() => setFadeOut(true), 600);
    const t2 = setTimeout(() => onDone?.(), 600 + 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [animationDone, apiDone, onDone]);

  const waitingForApi = animationDone && !apiDone && !showCompletion;

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
          <div className="text-text-muted mt-1">
            <span className="text-indigo mr-2">›</span>{elapsedMessage(elapsed)}
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
