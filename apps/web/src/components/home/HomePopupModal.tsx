"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

type PopupModalData = {
  id: string;
  imageUrl: string;
  redirectUrl: string | null;
};

const STORAGE_KEY = "popup_modal_seen_until";
const SUPPRESS_MS = 10 * 60 * 1000; // 10 minutes

export default function HomePopupModal({ modal }: { modal: PopupModalData }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seenUntil = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
    if (Date.now() < seenUntil) return;

    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [modal.id]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, String(Date.now() + SUPPRESS_MS));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      onClick={dismiss}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

      {/* Modal box */}
      <div
        className="relative w-full max-w-xl z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute -top-3 -right-3 z-20 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-surface-hover transition-colors"
          aria-label="Fechar modal"
        >
          <X size={16} className="text-text-dark" />
        </button>

        {/* Image */}
        {modal.redirectUrl ? (
          <a
            href={modal.redirectUrl}
            onClick={dismiss}
            className="block rounded-xl overflow-hidden"
          >
            <Image
              src={modal.imageUrl}
              alt="Promoção"
              width={600}
              height={800}
              className="w-full h-auto rounded-xl"
              priority
            />
          </a>
        ) : (
          <div className="rounded-xl overflow-hidden">
            <Image
              src={modal.imageUrl}
              alt="Promoção"
              width={600}
              height={800}
              className="w-full h-auto rounded-xl"
              priority
            />
          </div>
        )}
      </div>
    </div>
  );
}
