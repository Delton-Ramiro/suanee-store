"use client";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { CalendarDays } from "lucide-react";

interface DateTimePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minDate?: Date;
}

export default function DateTimePicker({
  value,
  onChange,
  placeholder,
  minDate,
}: DateTimePickerProps) {
  return (
    <div className="relative">
      <DatePicker
        selected={value}
        onChange={onChange}
        showTimeSelect
        timeFormat="HH:mm"
        timeIntervals={15}
        dateFormat="dd/MM/yyyy  HH:mm"
        placeholderText={placeholder ?? "Selecionar data e hora"}
        minDate={minDate ?? new Date()}
        showPopperArrow={false}
        popperPlacement="bottom-start"
        className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm font-figtree text-text-dark placeholder:text-text-subtle focus:outline-none focus:border-accent transition-colors pr-9 cursor-pointer"
      />
      <CalendarDays
        size={15}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
    </div>
  );
}
