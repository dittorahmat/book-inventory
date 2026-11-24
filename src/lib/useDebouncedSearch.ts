import { useEffect, useState } from "react";

/**
 * Hook kanonik pencarian ter-debounce (~300ms) dengan opsi callback reset halaman otomatis.
 * Menghilangkan duplikasi boilerplate setTimeout + auto-reset page ke 1 di seluruh tabel/view.
 */
export function useDebouncedSearch(
  initialQuery = "",
  delay = 300,
  onDebouncedChange?: (debouncedValue: string) => void
) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      if (onDebouncedChange) {
        onDebouncedChange(searchQuery);
      }
    }, delay);
    return () => clearTimeout(handler);
  }, [searchQuery, delay, onDebouncedChange]);

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearch,
  };
}
