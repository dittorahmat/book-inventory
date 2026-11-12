import { useState, useEffect } from "react";
import { getJson } from "./api";

/**
 * Hook untuk mengecek apakah mode override stok demo aktif.
 */
export function useDemoMode() {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await getJson<{ enabled: boolean }>("/api/settings/demo-mode");
      if (res) {
        setIsDemoMode(Boolean(res.enabled));
      }
    } catch {
      setIsDemoMode(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { isDemoMode, loading, refresh };
}
