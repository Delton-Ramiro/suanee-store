interface TextInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function TextInput({
  label,
  value,
  onChange,
  placeholder = "",
  disabled = false,
}: TextInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-primary font-figtree">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-primary text-sm font-figtree focus:outline-none focus:border-accent transition-colors placeholder:text-text-label disabled:bg-surface-hover disabled:cursor-default"
      />
    </div>
  );
}
