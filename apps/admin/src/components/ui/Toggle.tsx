"use client";

interface ToggleProps {
  label: string;
  value: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  /** Show Sim/Não text beside the toggle (default: true) */
  showText?: boolean;
  /**
   * "horizontal" (default): label left, toggle right — for form rows
   * "vertical": label above, toggle below — for side-by-side grid cards
   */
  orientation?: "horizontal" | "vertical";
}

export default function Toggle({
  label,
  value,
  onChange,
  disabled = false,
  showText = true,
  orientation = "horizontal",
}: ToggleProps) {
  const track = (
    <button
      type="button"
      onClick={() => !disabled && onChange?.(!value)}
      disabled={disabled}
      aria-pressed={value}
      className={[
        "relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none",
        value ? "bg-accent" : "bg-toggle-off",
        disabled ? "opacity-60 cursor-default" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-toggle-knob shadow-sm transition-transform duration-200",
          value ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );

  if (orientation === "vertical") {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <span className="text-s font-bold text-primary font-figtree">
            {label}
          </span>
        )}
        <div className="flex items-center gap-2">
          {track}
          {showText && (
            <span className="text-s text-text-muted font-inter">
              {value ? "Sim" : "Não"}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-text-body font-figtree">{label}</span>
      <div className="flex items-center gap-2">
        {showText && (
          <span className="text-s text-text-muted font-inter w-6 text-right">
            {value ? "Sim" : "Não"}
          </span>
        )}
        {track}
      </div>
    </div>
  );
}
