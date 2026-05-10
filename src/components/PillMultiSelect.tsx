import { useState } from "react";

interface Props {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  customPlaceholder?: string;
}

export function PillMultiSelect({ options, value, onChange, customPlaceholder }: Props) {
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");

  const customs = value.filter((v) => !options.includes(v));

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  const commitCustom = () => {
    const t = customText.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setCustomText("");
    setCustomMode(false);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((c) => {
        const active = value.includes(c);
        return (
          <button
            key={c}
            type="button"
            onClick={() => toggle(c)}
            className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
              active
                ? "bg-indigo border-indigo text-white"
                : "border-border text-text-secondary hover:text-text-primary hover:border-text-muted"
            }`}
          >
            {c}
          </button>
        );
      })}
      {customs.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => toggle(c)}
          className="px-3 py-1.5 text-xs rounded-sm border bg-indigo border-indigo text-white"
          title="click to remove"
        >
          {c} ×
        </button>
      ))}
      {customMode ? (
        <input
          autoFocus
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onBlur={commitCustom}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitCustom(); }
            if (e.key === "Escape") { setCustomText(""); setCustomMode(false); }
          }}
          placeholder={customPlaceholder ?? "type and press enter"}
          className="px-3 py-1.5 text-xs rounded-sm border border-indigo bg-surface text-text-primary focus:outline-none font-mono w-44"
        />
      ) : (
        <button
          type="button"
          onClick={() => setCustomMode(true)}
          className="px-3 py-1.5 text-xs rounded-sm border border-dashed border-border text-text-secondary hover:text-text-primary hover:border-text-muted"
        >
          + Custom
        </button>
      )}
    </div>
  );
}
