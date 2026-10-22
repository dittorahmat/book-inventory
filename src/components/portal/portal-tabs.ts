import { ArrowLeftRight, BookOpen, RotateCcw, Shirt } from "lucide-react";
import type { ComponentType } from "react";
import type { PortalTab } from "./usePublicOrder";

export interface PortalTabItem {
  id: PortalTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

/**
 * Satu-satunya sumber daftar tab portal publik. Tab baru **wajib** ditambah di
 * sini, bukan sebagai JSX inline: daftar data-driven membuat urutan, label, dan
 * kelengkapan tab bisa diuji (`PortalTabs.test.tsx`), sesuatu yang tidak bisa
 * dilakukan saat tab ditulis langsung di dalam view.
 */
export const PUBLIC_TABS: readonly PortalTabItem[] = [
  { id: "order", label: "Formulir Pesan Buku", icon: BookOpen },
  { id: "uniform", label: "Pesan Seragam", icon: Shirt },
  { id: "uniform_return", label: "Retur Seragam", icon: ArrowLeftRight },
  { id: "book_return", label: "Refund Buku", icon: RotateCcw },
];
