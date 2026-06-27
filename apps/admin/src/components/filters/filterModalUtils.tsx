"use client";

import { X } from "lucide-react";

export type DraftOption = { id?: string; label: string; value: string };

export function OptionTag({
  option,
  index,
  isDragOver,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  option: DraftOption;
  index: number;
  isDragOver: boolean;
  onRemove: () => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
      onDragEnd={onDragEnd}
      className={`relative inline-block mt-2.5 mr-2.5 cursor-grab active:cursor-grabbing select-none transition-opacity ${
        isDragOver ? "opacity-40 scale-95" : "opacity-100"
      }`}
    >
      <div className="bg-navy border border-border-light text-white text-md font-figtree font-normal rounded-[25px] px-4.5 py-1 whitespace-nowrap">
        {option.label}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1 -right-1 size-[18px] bg-navy rounded-full flex items-center justify-center text-white hover:text-navy hover:bg-surface-hover transition-colors z-10 shadow-sm"
        aria-label={`Remover ${option.label}`}
      >
        <X size={9} className="text-inherit" strokeWidth={2.5} />
      </button>
    </div>
  );
}
