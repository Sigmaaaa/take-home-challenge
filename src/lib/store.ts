import { useSyncExternalStore } from "react";

interface State {
  activeCorpusId: string | null;
}

let state: State = { activeCorpusId: null };
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
};
