"use client";

import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useChat, chatStore } from "@/lib/stores/chatStore";
import { useAuth } from "@/lib/auth";

export function ChatFab() {
  const { isOpen } = useChat();
  const { user } = useAuth();
  const router = useRouter();

  function handleClick() {
    if (user) {
      chatStore.open();
    } else {
      router.push("/login");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Abrir chat"
      className={`fixed bottom-6 right-6 z-50 flex items-center justify-center w-13 h-13 rounded-full bg-brand text-white shadow-lg hover:bg-primary hover:scale-105 active:scale-95 transition-all duration-200 ${
        isOpen ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <MessageCircle size={22} strokeWidth={1.75} />
    </button>
  );
}
