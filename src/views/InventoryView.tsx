import { useState, useEffect } from "react";
import { School, BookItem } from "../types";
import { Search, Tag } from "lucide-react";

export function InventoryView({ activeSchool }: { activeSchool: School | null }) {
  const [items, setItems] = useState<BookItem[]>([]);
  const [searchBarcode, setSearchBarcode] = useState("");
  const [conditionFilter, setConditionFilter] = useState<string>("all");

  const fetchItems = () => {
    if (!activeSchool) return;
    fetch(`/api/book-items?schoolId=${activeSchool.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setItems(data.data);
      });
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSchool]);

  const handleUpdateCondition = async (id: string, condition: "new" | "good" | "fair" | "damaged") => {
    await fetch(`/api/book-items/${id}/condition`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ condition }),
    });
    fetchItems();
  };

  const filteredItems = items.filter((item) => {
    const matchBarcode = item.barcode.toLowerCase().includes(searchBarcode.toLowerCase()) ||
      item.book?.title.toLowerCase().includes(searchBarcode.toLowerCase());
    const matchCondition = conditionFilter === "all" || item.condition === conditionFilter;
    return matchBarcode && matchCondition;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E5E0] pb-4">
        <div>
          <h2 className="text-xl font-editorial font-semibold text-[#1A1A1A]">
            Branch Stock Inventory
          </h2>
          <p className="text-xs text-[#737373]">
            Physical copies stationed at {activeSchool ? activeSchool.name : "..."} ({items.length} units total).
          </p>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#737373]" />
            <input
              type="text"
              placeholder="Scan or search barcode / title..."
              value={searchBarcode}
              onChange={(e) => setSearchBarcode(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs font-mono border border-[#E5E5E0] rounded bg-white w-64 focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>

          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="text-xs font-mono border border-[#E5E5E0] py-1.5 px-2 rounded bg-white text-[#555555]"
          >
            <option value="all">All Conditions</option>
            <option value="new">New</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="damaged">Damaged</option>
          </select>
        </div>
      </div>

      {/* Item List */}
      <div className="border border-[#E5E5E0] bg-white rounded overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#E5E5E0] bg-[#FAFAF8] text-[#737373] font-mono text-[11px]">
              <th className="py-2.5 px-4 font-normal">Barcode Tag</th>
              <th className="py-2.5 px-4 font-normal">Book Title</th>
              <th className="py-2.5 px-4 font-normal">ISBN</th>
              <th className="py-2.5 px-4 font-normal">Condition</th>
              <th className="py-2.5 px-4 font-normal">Status</th>
              <th className="py-2.5 px-4 font-normal text-right">Audit Condition</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0EC]">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#737373]">
                  No physical copies found at this branch.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#FAFAF8] transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-[#1A1A1A] flex items-center gap-1.5">
                    <Tag className="w-3 h-3 text-[#737373]" />
                    {item.barcode}
                  </td>
                  <td className="py-3 px-4 font-medium text-[#1A1A1A]">{item.book?.title || "Untitled"}</td>
                  <td className="py-3 px-4 font-mono text-[#737373]">{item.book?.isbn}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono capitalize ${
                        item.condition === "new"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : item.condition === "damaged"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-gray-100 text-gray-700 border border-gray-200"
                      }`}
                    >
                      {item.condition}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono capitalize ${
                        item.status === "in_stock"
                          ? "bg-slate-100 text-slate-700"
                          : item.status === "in_transit"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <select
                      value={item.condition}
                      onChange={(e) => handleUpdateCondition(item.id, e.target.value as any)}
                      className="text-[11px] font-mono border border-[#E5E5E0] rounded px-1.5 py-0.5 bg-white text-[#555555]"
                    >
                      <option value="new">New</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="damaged">Damaged</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
