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
    // Reset so same file can be re-uploaded
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Paste app IDs or App Store URLs (one per line, comma-separated, or mixed)..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={4}
        className="font-mono text-sm resize-none"
      />
      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.json,.csv,.text"
          onChange={handleFile}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
        >
          Upload File
        </Button>
        {value && (
          <span className="text-xs text-muted-foreground self-center">
            {parseAppIds(value).length} app(s) detected
          </span>
        )}
      </div>
    </div>
  );
}
