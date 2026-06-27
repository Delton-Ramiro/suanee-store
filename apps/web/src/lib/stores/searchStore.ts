import { useSyncExternalStore } from "react";

let isOpen = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const searchStore = {
  open() {
    isOpen = true;
    notify();
  },
  close() {
    isOpen = false;
    notify();
  },
};

export function useSearchOverlay(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => isOpen,
    () => false,
  );
}
