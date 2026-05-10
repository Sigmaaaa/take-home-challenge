import { useEffect, useState } from "react";

interface Props {
  lines: string[];
  intervalMs?: number;
  onDone?: () => void;
  finalDelayMs?: number;
}

export function TerminalLoader({ lines, intervalMs = 1500, onDone, finalDelayMs = 800 }: Props) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown >= lines.length) {
      const t = setTimeout(() => onDone?.(), finalDelayMs);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShown((s) => s + 1), intervalMs);
    return () => clearTimeout(t);
  }, [shown, lines.length, intervalMs, onDone, finalDelayMs]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-start justify-center pt-[20vh] px-6">
      <div className="w-full max-w-[680px] font-mono text-sm leading-relaxed">
        <div className="flex items-center gap-2 mb-4 text-indigo">
          <span className="blink-cursor" />
        </div>
        {lines.slice(0, shown + 1).map((line, i) => {
          const isActive = i === shown && i < lines.length;
          const isDone = i < shown;
          return (
            <div
              key={i}
              className={
                isDone
                  ? "text-text-muted"
                  : isActive
                  ? "text-text-primary blink-cursor"
                  : "text-text-primary"
              }
            >
              <span className="text-indigo mr-2">›</span>
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
}
