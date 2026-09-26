import { create } from 'zustand';
import type { AppData } from './types';
import { bridge } from './lib/bridge';
import { sampleData } from './lib/seed';

const LS_KEY = 'tour-time-data';

interface Store {
  data: AppData | null;
  load(): Promise<void>;
  /** Apply a mutation to a copy of the data, then persist it. */
  mutate(recipe: (draft: AppData) => void): void;
  replace(data: AppData): void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist(data: AppData) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const b = bridge();
    if (b) b.saveData(data);
    else {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(data));
      } catch {
        /* storage full or blocked */
      }
    }
  }, 300);
}

export const useStore = create<Store>((set, get) => ({
  data: null,
  async load() {
    const b = bridge();
    let loaded: AppData | null = null;
    try {
      loaded = b ? ((await b.loadData()) as AppData | null) : JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    } catch {
      loaded = null;
    }
    const data = loaded ?? sampleData();
    set({ data });
    if (!loaded) persist(data);
  },
  mutate(recipe) {
    const current = get().data;
    if (!current) return;
    const draft = structuredClone(current);
    recipe(draft);
    set({ data: draft });
    persist(draft);
  },
  replace(data) {
    set({ data });
    persist(data);
  },
}));

/** Convenience hook: the loaded data (non-null once the app has booted). */
export const useData = () => useStore((s) => s.data!);
export const useMutate = () => useStore((s) => s.mutate);

export function useActiveTour() {
  const data = useData();
  return data.tours.find((t) => t.id === data.activeTourId) ?? data.tours[0];
}
