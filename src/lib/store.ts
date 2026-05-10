import { useSyncExternalStore } from "react";
import { callFn } from "./supabase";

export interface ExtractionState {
  active: boolean;
  corpusName: string;
  charCount: number;
  apiDone: boolean;
  pendingCorpusId: string | null;
  error: string | null;
}

interface State {
  activeCorpusId: string | null;
  extraction: ExtractionState;
}

const initialExtraction: ExtractionState = {
  active: false,
  corpusName: "",
  charCount: 0,
  apiDone: false,
  pendingCorpusId: null,
  error: null,
};

let state: State = { activeCorpusId: null, extraction: initialExtraction };
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const getSnapshot = () => state;
const setState = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const storeActions = {
  setActiveCorpus(id: string | null) { setState({ activeCorpusId: id }); },

  async startExtraction(input: {
    name: string;
    text: string;
    source_type: string;
    source_label: string;
    language: string;
  }) {
    setState({
      extraction: {
        active: true,
        corpusName: input.name,
        charCount: input.text.length,
        apiDone: false,
        pendingCorpusId: null,
        error: null,
      },
    });
    try {
      const ingest = await callFn<{ corpus_id: string }>("ingest-corpus", {
        name: input.name,
        raw_text: input.text,
        source_type: input.source_type,
        source_label: input.source_label,
        language: input.language,
      });
      const corpusId = ingest.corpus_id;
      await callFn("extract-style", { corpus_id: corpusId });
      setState({
        extraction: { ...state.extraction, apiDone: true, pendingCorpusId: corpusId },
      });
    } catch (e: any) {
      setState({
        extraction: { ...state.extraction, error: e?.message || "Something went wrong.", active: false },
      });
    }
  },

  clearExtraction() {
    setState({ extraction: initialExtraction });
  },
};
