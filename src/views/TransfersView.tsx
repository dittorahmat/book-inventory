import { useState, useEffect } from "react";
import { School, BookItem, TransferShipment } from "../types";
import { Send, CheckCircle, Plus, ArrowRight } from "lucide-react";

export function TransfersView({ activeSchool }: { activeSchool: School | null }) {
  const [shipments, setShipments] = useState<TransferShipment[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [availableItems, setAvailableItems] = useState<BookItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [destinationSchoolId, setDestinationSchoolId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<TransferShipment | null>(null);

  const fetchShipments = () => {
    fetch("/api/shipments")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setShipments(data.data);
      });
  };

  useEffect(() => {
    fetchShipments();
    fetch("/api/schools")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAllSchools(data.data);
      });
  }, []);

  const loadAvailableItemsForTransfer = () => {
    if (!activeSchool) return;
    fetch(`/api/book-items?schoolId=${activeSchool.id}&status=in_stock`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAvailableItems(data.data);
      });
  };

  const handleCreateShipment = async () => {
    if (!activeSchool || !destinationSchoolId || selectedItems.length === 0) return;
    const res = await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromSchoolId: activeSchool.id,
        toSchoolId: destinationSchoolId,
        bookItemIds: selectedItems,
        notes: "Scheduled distribution",
      }),
    });
    const data = await res.json();
    if (data.success) {
      setIsCreating(false);
      setSelectedItems([]);
      fetchShipments();
    } else {
      alert(data.message || "Failed to create shipment");
    }
  };

  const handleDispatch = async (id: string) => {
    await fetch(`/api/shipments/${id}/dispatch`, { method: "POST" });
    fetchShipments();
    if (selectedShipment?.id === id) openShipmentDetail(id);
  };

  const handleReceive = async (shipment: TransferShipment) => {
    if (!shipment.items) return;
    const receipts = shipment.items.map((item) => ({
      bookItemId: item.bookItemId,
      condition: "good" as const,
    }));

    await fetch(`/api/shipments/${shipment.id}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemReceipts: receipts }),
    });
    fetchShipments();
    openShipmentDetail(shipment.id);
  };

  const openShipmentDetail = async (id: string) => {
    const res = await fetch(`/api/shipments/${id}`);
    const data = await res.json();
    if (data.success) {
      setSelectedShipment(data.data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#E5E5E0] pb-4">
        <div>
          <h2 className="text-xl font-editorial font-semibold text-[#1A1A1A]">
            Inter-School Stock Transfers
          </h2>
          <p className="text-xs text-[#737373]">
            Logistics shipments between Central HQ and branch schools.
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreating(true);
            loadAvailableItemsForTransfer();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-[#1A1A1A] text-white rounded hover:bg-[#333333] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Shipment
        </button>
      </div>

      {/* Create Modal */}
      {isCreating && (
        <div className="p-4 border border-[#E5E5E0] bg-white rounded space-y-4 max-w-xl">
          <div className="font-editorial font-medium text-sm">Draft New Transfer Shipment</div>
          <div className="text-xs text-[#737373]">
            Origin: <span className="font-medium text-[#1A1A1A]">{activeSchool?.name}</span>
          </div>

          <div>
            <label className="block text-xs text-[#737373] mb-1">Destination Branch</label>
            <select
              value={destinationSchoolId}
              onChange={(e) => setDestinationSchoolId(e.target.value)}
              className="w-full border border-[#E5E5E0] p-1.5 rounded text-xs"
            >
              <option value="">Select Destination School</option>
              {allSchools
                .filter((s) => s.id !== activeSchool?.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#737373] mb-1">
              Select Book Copies to Dispatch ({availableItems.length} available in stock)
            </label>
            <div className="border border-[#E5E5E0] rounded max-h-40 overflow-y-auto divide-y divide-[#F0F0EC] p-2 text-xs">
              {availableItems.length === 0 ? (
                <div className="text-[#737373] py-2">No copies in stock to send.</div>
              ) : (
                availableItems.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedItems([...selectedItems, item.id]);
                        else setSelectedItems(selectedItems.filter((id) => id !== item.id));
                      }}
                    />
                    <span className="font-mono">{item.barcode}</span>
                    <span className="text-[#737373]">({item.book?.title})</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setIsCreating(false)}
              className="px-3 py-1 text-xs border border-[#E5E5E0] rounded text-[#737373]"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateShipment}
              disabled={!destinationSchoolId || selectedItems.length === 0}
              className="px-3 py-1 text-xs bg-[#1A1A1A] text-white rounded font-mono disabled:opacity-50"
            >
              Save Draft
            </button>
          </div>
        </div>
      )}

      {/* Shipments List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shipments.map((s) => (
          <div
            key={s.id}
            onClick={() => openShipmentDetail(s.id)}
            className="border border-[#E5E5E0] bg-white p-4 rounded hover:border-[#1A1A1A] cursor-pointer transition-colors space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-[#1A1A1A]">{s.shipmentNumber}</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded capitalize ${
                  s.status === "completed"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : s.status === "in_transit"
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {s.status.replace("_", " ")}
              </span>
            </div>

            <div className="text-xs text-[#737373] flex items-center gap-1.5">
              <span>{allSchools.find((sch) => sch.id === s.fromSchoolId)?.name || s.fromSchoolId}</span>
              <ArrowRight className="w-3 h-3 text-[#1A1A1A]" />
              <span>{allSchools.find((sch) => sch.id === s.toSchoolId)?.name || s.toSchoolId}</span>
            </div>

            <div className="pt-2 flex justify-between items-center text-[11px] font-mono text-[#737373] border-t border-[#F4F4F0]">
              <span>Created {new Date(s.createdAt).toLocaleDateString()}</span>
              <span className="text-[#1A1A1A]">Click to view details</span>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#E5E5E0] rounded p-5 max-w-lg w-full space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E5E5E0] pb-2">
              <div>
                <div className="font-editorial font-semibold text-base">{selectedShipment.shipmentNumber}</div>
                <div className="text-xs text-[#737373]">
                  {selectedShipment.fromSchool?.name} &rarr; {selectedShipment.toSchool?.name}
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F4F4F0] uppercase">
                {selectedShipment.status}
              </span>
            </div>

            <div>
              <div className="text-xs font-mono text-[#737373] mb-1">Manifest Items ({selectedShipment.items?.length || 0})</div>
              <div className="divide-y divide-[#F0F0EC] border border-[#E5E5E0] rounded max-h-48 overflow-y-auto text-xs">
                {selectedShipment.items?.map((item) => (
                  <div key={item.id} className="p-2 flex justify-between items-center">
                    <div>
                      <div className="font-mono font-medium text-[#1A1A1A]">{item.barcode}</div>
                      <div className="text-[#737373] text-[11px]">{item.bookTitle}</div>
                    </div>
                    {item.receivedCondition && (
                      <span className="text-[10px] font-mono text-[#555555]">
                        Condition: {item.receivedCondition}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setSelectedShipment(null)}
                className="px-3 py-1.5 text-xs border border-[#E5E5E0] rounded text-[#737373]"
              >
                Close
              </button>

              {selectedShipment.status === "draft" && (
                <button
                  onClick={() => handleDispatch(selectedShipment.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-[#1A1A1A] text-white rounded font-mono"
                >
                  <Send className="w-3 h-3" />
                  Dispatch Shipment
                </button>
              )}

              {selectedShipment.status === "in_transit" && (
                <button
                  onClick={() => handleReceive(selectedShipment)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-700 text-white rounded font-mono"
                >
                  <CheckCircle className="w-3 h-3" />
                  Receive Shipment
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
