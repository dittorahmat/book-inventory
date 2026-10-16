import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { SearchableOption } from "./SearchableSingleSelect";

interface SearchableMultiSelectProps {
  id?: string;
  label?: string;
  options: SearchableOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  emptyText?: string;
}

/** Dropdown multi-select searchable dengan checkbox + chip + counter. */
export function SearchableMultiSelect({
  id,
  label,
  options,
  values,
  onChange,
  placeholder = "Pilih...",
  searchPlaceholder = "Ketik untuk mencari...",
  disabled,
  emptyText = "Tidak ada hasil yang cocok.",
}: SearchableMultiSelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const selectedSet = useMemo(() => new Set(values), [values]);
  const selectedLabels = options.filter((o) => selectedSet.has(o.value));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open ]);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open ]);

  const toggle = (val: string) =>
    onChange(selectedSet.has(val) ? values.filter((v) => v !== val) : [...values, val]);

  return (
    <div ref={rootRef} className="relative">
      {label ? (
        <label htmlFor={inputId} className="block text-xs font-semibold text-[#050505] mb-1">
          {label}
        </label>
      ) : null}
      <button
        id={inputId}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-left text-[#050505] flex items-center justify-between gap-2 focus:outline-hidden focus:border-[#1877F2] disabled:opacity-60"
      >
        <span className="min-w-0 flex-1 truncate">
          {selectedLabels.length === 0 ? (
            <span className="text-[#65676B]">{placeholder}</span>
          ) : (
            <span className="font-medium">
              {selectedLabels.length} dipilih: {selectedLabels.slice(0, 2).map((s) => s.label).join(", ")}
              {selectedLabels.length > 2 ? "…" : ""}
            </span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-[#65676B]" />
      </button>
      {selectedLabels.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {selectedLabels.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => toggle(s.value)}
              disabled={disabled}
              title={`Hapus ${s.label}`}
              className="text-[10px] font-semibold bg-[#E7F3FF] text-[#1877F2] px-2 py-0.5 rounded-full hover:bg-[#D8ECFF] active:scale-[0.98] disabled:opacity-50"
            >
              {s.label} ×
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={disabled}
            className="text-[10px] font-semibold text-[#65676B] hover:underline disabled:opacity-50"
          >
            Bersihkan
          </button>
        </div>
      ) : null}
      {open && !disabled ? (
        <div className="absolute z-50 mt-1 w-full bg-white border border-[#E4E6EB] rounded-xl shadow-xl overflow-hidden">
          <div className="relative border-b border-[#E4E6EB]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#65676B]" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 text-xs focus:outline-none"
            />
          </div>
          <ul role="listbox" aria-multiselectable className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-[#65676B] text-center">{emptyText}</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <label className="w-full px-3 py-2 flex items-center gap-2.5 cursor-pointer hover:bg-[#F7F8FA] text-xs">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(o.value)}
                      onChange={() => toggle(o.value)}
                      className="w-4 h-4 accent-[#1877F2]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-[#050505] truncate">{o.label}</span>
                      {o.hint ? <span className="block text-[10px] text-[#65676B] truncate">{o.hint}</span> : null}
                    </span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
