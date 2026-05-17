"use client";

import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { parseAppIds } from "@/lib/parse-app-ids";

interface AppInputProps {
  value: string;
  onChange: (value: string) => void;
  onFileLoad: (ids: string[]) => void;
  disabled?: boolean;
}

export function AppInput({ value, onChange, onFileLoad, disabled }: AppInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const ids = parseAppIds(text);
      if (ids.length > 0) {
        onFileLoad(ids);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const detectedCount = value ? parseAppIds(value).length : 0;

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Paste app IDs or App Store URLs (one per line, comma-separated, or mixed)..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={3}
        className="font-mono text-sm resize-none bg-input/50 border-border focus:border-primary/50"
      />
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.json,.csv,.text,.md"
          onChange={handleFile}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="gap-2 text-xs"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
          Upload File
        </Button>
        {detectedCount > 0 && (
          <span className="text-[11px] text-primary font-medium">
            {detectedCount} app{detectedCount !== 1 ? "s" : ""} detected
          </span>
        )}
      </div>
    </div>
  );
}
