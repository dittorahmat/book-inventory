import { useEffect, useState } from "react";
import { MapPin, Phone, Building2 } from "lucide-react";
import { getJson } from "../../lib/api";
import type { WarehouseReturnAddress } from "../../server/services/return-address";

export function WarehouseReturnAddressCard() {
  const [address, setAddress] = useState<WarehouseReturnAddress | null>(null);

  useEffect(() => {
    getJson<WarehouseReturnAddress>("/api/public/orders/return-address")
      .then(setAddress)
      .catch(() => {});
  }, []);

  if (!address) return null;

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 space-y-1.5">
      <div className="font-bold flex items-center gap-2 text-blue-800">
        <Building2 className="w-4 h-4 text-[#1877F2]" />
        <span>Alamat Pengiriman Retur Fisik ke Gudang Pusat</span>
      </div>
      <div className="text-[#050505] pl-6 font-semibold">{address.recipientName}</div>
      <div className="text-[#65676B] pl-6 flex items-start gap-1">
        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-500" />
        <span>
          {address.addressLine}, {address.district}, {address.city} {address.postalCode}
        </span>
      </div>
      <div className="text-[#65676B] pl-6 flex items-center gap-1">
        <Phone className="w-3.5 h-3.5 shrink-0 text-gray-500" />
        <span>Telp / WA: {address.phone}</span>
      </div>
      {address.notes && (
        <div className="text-[11px] text-gray-500 pl-6 italic">Catatan kurir: {address.notes}</div>
      )}
    </div>
  );
}
