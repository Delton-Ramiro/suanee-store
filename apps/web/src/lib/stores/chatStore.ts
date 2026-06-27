import { useSyncExternalStore } from "react";

type ChatState = {
  isOpen: boolean;
};

let state: ChatState = { isOpen: false };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const chatStore = {
  open() {
    state = { isOpen: true };
    notify();
  },
  close() {
    state = { isOpen: false };
    notify();
  },
};

export function useChat(): ChatState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => ({ isOpen: false }),
  );
}
