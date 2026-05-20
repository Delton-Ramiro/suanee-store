interface FormFieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  maxLength?: number;
}

export default function FormField({
  label,
  id,
  value,
  onChange,
  placeholder,
  autoFocus,
  maxLength,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-s font-semibold text-text-dark font-figtree"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={maxLength}
        className="w-full bg-bg border border-border-light rounded-lg px-4 py-2.5 text-sm text-text-dark font-figtree placeholder:text-text-muted outline-none focus:border-accent transition-colors"
      />
    </div>
  );
}
