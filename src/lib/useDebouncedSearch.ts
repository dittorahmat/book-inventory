import { useEffect, useState } from "react";

/**
 * Hook kanonik pencarian ter-debounce (~300ms) dengan reset halaman otomatis.
 * Menghilangkan duplikasi boilerplate setTimeout + auto-reset page ke 1 di seluruh tabel/view.
 */
export function useDebouncedSearch(initialQuery = "", delay = 300) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, delay);
    return () => clearTimeout(handler);
  }, [searchQuery, delay]);

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearch,
  };
}
