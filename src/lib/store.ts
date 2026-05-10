import { useSyncExternalStore } from "react";
import { mockCorpus, mockHistory, type Corpus, type Generation } from "./mock-data";

interface State {
  corpora: Corpus[];
  activeCorpusId: string | null;
  history: Generation[];
}

let state: State = {
  corpora: [mockCorpus],
  activeCorpusId: mockCorpus.id,
  history: mockHistory,
};

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getSnapshot = () => state;
const setState = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const storeActions = {
  setActiveCorpus(id: string) {
    setState({ activeCorpusId: id });
  },
  addCorpus(c: Corpus) {
    setState({ corpora: [...state.corpora, c], activeCorpusId: c.id });
  },
  addGeneration(g: Generation) {
    setState({ history: [g, ...state.history] });
  },
};

export function getActiveCorpus(): Corpus | null {
  return state.corpora.find((c) => c.id === state.activeCorpusId) ?? null;
}
