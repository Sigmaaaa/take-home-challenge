import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { TerminalLoader } from "./TerminalLoader";
import { useStore, storeActions } from "@/lib/store";

const EXTRACTION_LINES = [
  "Parsing corpus across registers...",
  "Extracting coarse signal — social orientation and register...",
  "Mapping discourse structure and information flow...",
  "Detecting prosodic compensation patterns...",
  "Computing pronoun ratio and politeness strategy...",
  "Analyzing hedging and intensifier distribution...",
  "Building cognitive style hierarchy (coarse → mid → fine)...",
  "Crystallizing your linguistic fingerprint...",
];

export function GlobalExtractionLoader() {
  const { extraction } = useStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  if (!extraction.active) return null;

  const onDone = () => {
    if (extraction.pendingCorpusId) {
      storeActions.setActiveCorpus(extraction.pendingCorpusId);
      qc.invalidateQueries({ queryKey: ["corpora"] });
    }
    storeActions.clearExtraction();
    navigate({ to: "/profile" });
  };

  return (
    <TerminalLoader
      lines={EXTRACTION_LINES}
      charCount={extraction.charCount}
      apiDone={extraction.apiDone}
      corpusName={extraction.corpusName}
      onDone={onDone}
    />
  );
}
