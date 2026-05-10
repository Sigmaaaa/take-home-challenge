import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

interface Props {
  lines: string[];
  charCount: number;
  apiDone: boolean;
  corpusName?: string;
  onDone?: () => void;
}

function elapsedMessage(secs: number): string {
  const s = Math.max(2, secs);
  if (secs <= 10) return `${s}s — warming up the neurons...`;
  if (secs <= 20) return `${s}s — reading between the lines...`;
  if (secs <= 30) return `${s}s — your writing has layers...`;
  if (secs <= 40) return `${s}s — this one's complex (good sign)...`;
  if (secs <= 50) return `${s}s — detecting your personality...`;
  if (secs <= 60) return `${s}s — almost crystallized...`;
  if (secs <= 70) return `${s}s — worth the wait, promise...`;
  return `${s}s — any second now...`;
}

const AUTO_MINIMIZE_AFTER_LINES = 5;

export function TerminalLoader({ lines, charCount, apiDone, corpusName, onDone }: Props) {
  const lineInterval = useMemo(() => {
    const estimatedSeconds = Math.max(28, Math.floor(charCount / 1500));
    return Math.floor((estimatedSeconds * 0.75 * 1000) / 9);
  }, [charCount]);

  const [shown, setShown] = useState(0);
  const [animationDone, setAnimationDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [userToggled, setUserToggled] = useState(false);
  const startRef = useRef<number>(Date.now());

  // Advance lines
  useEffect(() => {
    if (shown >= lines.length - 1) {
      setAnimationDone(true);
      return;
    }
    const t = setTimeout(() => setShown((s) => s + 1), lineInterval);
    return () => clearTimeout(t);
  }, [shown, lines.length, lineInterval]);

  // Auto-minimize once we've shown the first N lines (unless user already toggled)
  useEffect(() => {
    if (userToggled || minimized) return;
    if (shown + 1 >= AUTO_MINIMIZE_AFTER_LINES) {
      const t = setTimeout(() => setMinimized(true), lineInterval);
      return () => clearTimeout(t);
    }
  }, [shown, minimized, userToggled, lineInterval]);

  // Tick elapsed seconds (always running while pending)
  useEffect(() => {
    if (apiDone) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [apiDone]);

  // Completion handling — depends on minimized vs fullscreen
  useEffect(() => {
    if (!(animationDone && apiDone)) return;
    setShowCompletion(true);
    if (minimized) {
      // Card mode: show ready line, navigate after 1.5s, no fade
      const t = setTimeout(() => onDone?.(), 1500);
      return () => clearTimeout(t);
    }
    // Fullscreen mode: linger then fade
    const t1 = setTimeout(() => setFadeOut(true), 2500);
    const t2 = setTimeout(() => onDone?.(), 2500 + 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [animationDone, apiDone, onDone, minimized]);

  const waitingForApi = animationDone && !apiDone && !showCompletion;

  const minimize = () => { setUserToggled(true); setMinimized(true); };
  const expand = () => { setUserToggled(true); setMinimized(false); };

  // Compact floating card
  if (minimized) {
    return (
      <button
        type="button"
        onClick={showCompletion ? undefined : expand}
        className="fixed top-5 right-5 z-50 w-[320px] text-left bg-[#1A1A1A] border border-border border-l-2 border-l-indigo px-3 py-2.5 font-mono text-xs animate-[fade-in_0.3s_ease-out] hover:border-l-indigo hover:border-border/80 transition-colors"
      >
        {showCompletion ? (
          <div className="text-indigo flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-indigo" />
            <span className="truncate">
              › Analysis complete — {corpusName || "Corpus"} is ready
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-text-muted">
            <span className="size-1.5 rounded-full bg-indigo animate-pulse shrink-0" />
            <span className="truncate">
              › {waitingForApi ? elapsedMessage(elapsed) : (lines[shown] ?? "")}
            </span>
          </div>
        )}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex items-start justify-center pt-[20vh] px-6 transition-opacity duration-[500ms]"
      style={{ opacity: fadeOut ? 0 : 1 }}
    >
      <div className="absolute top-4 left-5 font-mono text-[11px] small-caps text-text-muted">
        Tone &amp; Style
      </div>
      <button
        type="button"
        onClick={minimize}
        className="absolute top-3 right-4 flex items-center gap-1.5 font-mono text-[11px] text-text-muted hover:text-text-primary transition-colors"
      >
        <span className="small-caps">skip animation</span>
        <X className="size-3.5" />
      </button>
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
