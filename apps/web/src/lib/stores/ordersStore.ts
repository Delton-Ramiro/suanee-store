import { useSyncExternalStore } from "react";

let isOpen = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const ordersStore = {
  open() {
    isOpen = true;
    notify();
  },
  close() {
    isOpen = false;
    notify();
  },
};

export function useOrdersDrawer(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => isOpen,
    () => false,
  );
}
