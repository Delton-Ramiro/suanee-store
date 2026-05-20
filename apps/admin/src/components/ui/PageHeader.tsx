import { CirclePlus, SquarePlus } from "lucide-react";

interface PageHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function PageHeader({
  title,
  actionLabel,
  onAction,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <h2 className="text-[20px] font-bold text-primary font-lato tracking-[0.04em]">
        {title}
      </h2>
      {actionLabel && onAction ? (
        <button
          onClick={onAction}
          className="self-start sm:self-auto flex items-center gap-2 bg-navy text-white text-md font-bold font-figtree pl-3 pr-5 py-3 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity"
        >
          <CirclePlus size={20} />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
