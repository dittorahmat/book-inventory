import { useCallback, useEffect, useState } from "react";
import { BookOpen, Edit3, Plus, XCircle } from "lucide-react";
import type { StaffShellContext } from "../components/layout/staff-tab-views";
import {
  TeacherHandbookForm,
  type AllocationItem,
  type BookOption,
} from "../components/teacher-handbooks/TeacherHandbookForm";
import { readResponseErrorMessage } from "../lib/api";

interface TeacherHandbookOrder {
  id: string;
  orderNumber: string;
  schoolId: string;
  schoolName: string | null;
  status: "pending" | "in_transit" | "received" | "completed" | "cancelled";
  notes: string | null;
  createdAt: string;
  allocations: AllocationItem[];
}

const STATUS_LABELS: Record<TeacherHandbookOrder["status"], string> = {
  pending: "Menunggu Pengiriman",
  in_transit: "Dalam Pengiriman",
  received: "Diterima Cabang",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const emptyAllocation = (): AllocationItem => ({
  bookId: "",
  teacherName: "",
  gradeLevel: "",
  rombel: "",
  subject: "",
  quantity: 1,
});

export function TeacherHandbooksView({ context }: { context: StaffShellContext }) {
  const [orders, setOrders] = useState<TeacherHandbookOrder[]>([]);
  const [books, setBooks] = useState<BookOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState(context.userSchoolId ?? context.schools[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [allocations, setAllocations] = useState<AllocationItem[]>([emptyAllocation()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, booksRes] = await Promise.all([
        fetch("/api/teacher-handbooks"),
        fetch("/api/books"),
      ]);
      if (!ordersRes.ok) throw new Error(await readResponseErrorMessage(ordersRes));
      if (!booksRes.ok) throw new Error(await readResponseErrorMessage(booksRes));

      const ordersJson = (await ordersRes.json()) as { data: TeacherHandbookOrder[] };
      const booksJson = (await booksRes.json()) as { data: BookOption[] };
      setOrders(ordersJson.data ?? []);
      setBooks(booksJson.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data Pegangan Guru.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateForm = () => {
    setEditingOrderId(null);
    setSchoolId(context.userSchoolId ?? context.schools[0]?.id ?? "");
    setNotes("");
    setAllocations([emptyAllocation()]);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (order: TeacherHandbookOrder) => {
    setEditingOrderId(order.id);
    setSchoolId(order.schoolId);
    setNotes(order.notes ?? "");
    setAllocations(
      order.allocations.map((a) => ({
        bookId: a.bookId,
        teacherName: a.teacherName,
        gradeLevel: a.gradeLevel ?? "",
        rombel: a.rombel ?? "",
        subject: a.subject ?? "",
        quantity: a.quantity,
      }))
    );
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const invalid = allocations.find((a) => !a.bookId || !a.teacherName.trim() || a.quantity < 1);
    if (invalid) {
      setFormError("Pastikan setiap baris alokasi memiliki buku, nama guru, dan jumlah minimal 1.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        schoolId: context.isCentralAdmin ? schoolId : undefined,
        notes: notes.trim() || null,
        allocations: allocations.map((a) => ({
          bookId: a.bookId,
          teacherName: a.teacherName.trim(),
          gradeLevel: a.gradeLevel.trim() || null,
          rombel: a.rombel.trim() || null,
          subject: a.subject.trim() || null,
          quantity: Number(a.quantity),
        })),
      };

      const url = editingOrderId ? `/api/teacher-handbooks/${editingOrderId}` : "/api/teacher-handbooks";
      const method = editingOrderId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readResponseErrorMessage(res));

      setShowForm(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan pesanan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/teacher-handbooks/${orderId}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error(await readResponseErrorMessage(res));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membatalkan pesanan.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            Pesanan Pegangan Guru
          </h2>
          <p className="text-sm text-slate-500">
            Pengajuan buku pegangan guru oleh cabang beserta rincian alokasi guru.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" />
          Buat Pesanan Guru
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <TeacherHandbookForm
          editingOrderId={editingOrderId}
          isCentralAdmin={context.isCentralAdmin}
          schools={context.schools}
          schoolId={schoolId}
          onSchoolIdChange={setSchoolId}
          notes={notes}
          onNotesChange={setNotes}
          allocations={allocations}
          onAllocationsChange={setAllocations}
          books={books}
          formError={formError}
          isSubmitting={isSubmitting}
          onCancel={() => setShowForm(false)}
          onSubmit={handleSubmit}
          emptyAllocation={emptyAllocation}
        />
      )}

      {loading ? (
        <div className="text-sm text-slate-500 py-8 text-center">Memuat pesanan pegangan guru...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          Belum ada pesanan pegangan guru.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{order.orderNumber}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {order.schoolName ?? order.schoolId} {order.notes ? `• ${order.notes}` : ""}
                  </p>
                </div>
                {order.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(order)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Revisi
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelOrder(order.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Batalkan
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-t border-slate-100">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="py-1.5 pr-3">Buku</th>
                      <th className="py-1.5 pr-3">Guru</th>
                      <th className="py-1.5 pr-3">Kelas/Mapel</th>
                      <th className="py-1.5 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.allocations.map((a, i) => (
                      <tr key={a.id ?? i}>
                        <td className="py-1.5 pr-3 font-medium text-slate-800">{a.bookTitle ?? a.bookId}</td>
                        <td className="py-1.5 pr-3 text-slate-700">{a.teacherName}</td>
                        <td className="py-1.5 pr-3 text-slate-500">
                          {[a.gradeLevel, a.rombel, a.subject].filter(Boolean).join(" / ") || "-"}
                        </td>
                        <td className="py-1.5 text-right font-medium">{a.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
