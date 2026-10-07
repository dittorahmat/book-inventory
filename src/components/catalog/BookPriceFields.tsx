interface BookPriceFieldsProps {
  price: number;
  buyPrice: number;
  sellPrice: number;
  onChange: (field: "price" | "buyPrice" | "sellPrice", value: number) => void;
}

const inputClass =
  "w-full border border-[#CED0D4] p-2.5 rounded-lg text-xs font-bold text-[#1877F2] focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]";
const labelClass = "block text-xs font-semibold text-[#050505] mb-1";

function toNonNegative(val: string): number {
  return Math.max(0, parseInt(val) || 0);
}

/** Kolom harga buku: harga dasar (legacy), harga beli, harga jual. Nilai 0 = ikut harga dasar. */
export function BookPriceFields({ price, buyPrice, sellPrice, onChange }: BookPriceFieldsProps) {
  return (
    <>
      <div className="col-span-2 sm:col-span-1">
        <label className={labelClass}>Harga Dasar (Rp)</label>
        <input
          type="number"
          min={0}
          step={5000}
          className={inputClass}
          placeholder="0"
          value={price === 0 ? "" : price}
          onChange={(e) => onChange("price", toNonNegative(e.target.value))}
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className={labelClass}>Harga Beli (Rp)</label>
        <input
          type="number"
          min={0}
          step={5000}
          className={inputClass}
          placeholder="Ikut harga dasar (0)"
          value={buyPrice === 0 ? "" : buyPrice}
          onChange={(e) => onChange("buyPrice", toNonNegative(e.target.value))}
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className={labelClass}>Harga Jual (Rp)</label>
        <input
          type="number"
          min={0}
          step={5000}
          className={inputClass}
          placeholder="Ikut harga dasar (0)"
          value={sellPrice === 0 ? "" : sellPrice}
          onChange={(e) => onChange("sellPrice", toNonNegative(e.target.value))}
        />
        <p className="text-[10px] text-[#65676B] mt-1">
          Kosongkan (0) untuk mengikuti harga dasar. Harga jual dipakai menghitung harga paket.
        </p>
      </div>
    </>
  );
}
