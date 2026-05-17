"use client";

import { RATING_OPTIONS } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RatingFilterProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function RatingFilter({ value, onChange, disabled }: RatingFilterProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v);
      }}
      disabled={disabled}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Rating filter" />
      </SelectTrigger>
      <SelectContent>
        {RATING_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
