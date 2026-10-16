import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export interface SearchableOption {
  value: string;
  label: string;
  hint?: string;
}

interface SearchableSingleSelectProps {
  id?: string;
  label?: string;
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  emptyText?: string;
}

/** Dropdown tunggal searchable: trigger + popover + filter ketikan + keyboard. */
export function SearchableSingleSelect({
  id,
  label,
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  searchPlaceholder = "Ketik untuk mencari...",
  required,
  disabled,
  emptyText = "Tidak ada hasil yang cocok.",
}: SearchableSingleSelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const selected = options.find((o) => o.value === value) ?? null;

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
      setHighlight(0);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open ]);

  const pick = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      {label ? (
        <label htmlFor={inputId} className="block text-xs font-semibold text-[#050505] mb-1">
          {label}
          {required ? " *" : ""}
        </label>
      ) : null}
      <div className="flex gap-2">
        <button
          id={inputId}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex-1 px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-left text-[#050505] flex items-center justify-between gap-2 focus:outline-hidden focus:border-[#1877F2] disabled:opacity-60"
        >
          <span className={selected ? "font-medium truncate" : "text-[#65676B] truncate"}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="w-4 h-4 shrink-0 text-[#65676B]" />
        </button>
        {value && !required ? (
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={disabled}
            aria-label="Bersihkan pilihan"
            className="px-2.5 py-2 border border-[#CED0D4] rounded-xl hover:bg-[#F0F2F5] active:scale-[0.98] disabled:opacity-50"
          >
            <X className="w-4 h-4 text-[#65676B]" />
          </button>
        ) : null}
      </div>
      {open && !disabled ? (
        <div className="absolute z-50 mt-1 w-full bg-white border border-[#E4E6EB] rounded-xl shadow-xl overflow-hidden">
          <div className="relative border-b border-[#E4E6EB]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#65676B]" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered[highlight]) pick(filtered[highlight].value);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 text-xs focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-[#65676B] text-center">{emptyText}</li>
            ) : (
              filtered.map((o, idx) => (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    onClick={() => pick(o.value)}
                    onMouseEnter={() => setHighlight(idx)}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 ${
                      idx === highlight ? "bg-[#E7F3FF]" : o.value === value ? "bg-[#F0F2F5]" : "bg-white hover:bg-[#F7F8FA]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-[#050505] truncate">{o.label}</span>
                      {o.hint ? <span className="block text-[10px] text-[#65676B] truncate">{o.hint}</span> : null}
                    </span>
                    {o.value === value ? <span className="text-[#1877F2] font-bold">✓</span> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
