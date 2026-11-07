import { describe, it, expect } from "bun:test";
import { parsePoSheetAw1Allocation, aggregateAw1Allocations } from "./extract-aw1-po-allocations";

describe("parsePoSheetAw1Allocation", () => {
  it("should parse PG sheet allocation correctly for AW-1", () => {
    const csvSnippet = `
REKAPITULASI ESTIMASI PO BUKU JENJANG PLAY GROUP,,,,,,,
,,,,,,,
No.,Buku PG,JUMLAH MURID/ SANTRI,,,,TOTAL,KETERANGAN
,,AL-WILDAN,,,,,
,,AW1,AW20,AW22,AW,,
,,30,0,0,0,,
1,Bahasa Arab,30,0,0,0,30,
2,I LEAP NURSERY ENGLISH COURSEBOOK A,30,0,0,0,30,
`.trim();

    const items = parsePoSheetAw1Allocation("PG", csvSnippet);
    expect(items.length).toBe(2);
    expect(items[0]).toEqual({
      jenjang: "PG",
      title: "Bahasa Arab",
      quantity: 30,
    });
    expect(items[1]).toEqual({
      jenjang: "PG",
      title: "I LEAP NURSERY ENGLISH COURSEBOOK A",
      quantity: 30,
    });
  });

  it("should parse SD1 sheet allocation summing INT + MQ for AW-1", () => {
    const csvSnippet = `
REKAPITULASI ESTIMASI PO BUKU JENJANG SD KELAS 1,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
NO,Buku KLS 1 ,JUMLAH MURID,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,, TOTAL,KETERANGAN
,,AW-1,,AW-4,,AW-5,,AW-7,,AW-8,,AW-10,,AW-11,,AW-12,,AW-14,,AW-15,,AW-16,,AW-20,,AW-22,,AW-23,,AW-24
,,INT,MQ,INT,MQ,INT,MQ,INT,MQ,INT,MQ,INT,MQ,INT,MQ,INT,MQ,INT,MQ,INT,MQ,INT,MQ,INT,MQ,INT,MQ,INT,MQ,
,,120,35,130,0,30,0,30,15,30,20,80,0,20,20,100,0,80,0,60,0,60,0,80,0,50,0,50,,40,,30,,30,,  1.110 ,
1,Akidah Akhlak 1,120,35,130,0,30,0,30,15,30,20,80,0,20,20,100,0,80,0,60,0,60,0,80,0,50,0,50,,40,,30,,30,,  1.110 ,
2,Prime Math 1A Student Book,120,0,130,0,30,0,30,15,30,20,80,0,20,20,100,0,80,0,60,0,60,0,80,0,50,0,50,,40,,30,,30,,  1.020 ,
`.trim();

    const items = parsePoSheetAw1Allocation("SD1", csvSnippet);
    expect(items.length).toBe(2);
    expect(items[0]).toEqual({
      jenjang: "SD1",
      title: "Akidah Akhlak 1",
      quantity: 155, // 120 INT + 35 MQ
    });
    expect(items[1]).toEqual({
      jenjang: "SD1",
      title: "Prime Math 1A Student Book",
      quantity: 120, // 120 INT + 0 MQ
    });
  });

  it("should aggregate items across duplicate titles accurately", () => {
    const raw = [
      { jenjang: "SD1", title: "Akidah Akhlak 1", quantity: 155 },
      { jenjang: "SD2", title: "Akidah Akhlak 1", quantity: 45 },
      { jenjang: "SD1", title: "Prime Math 1A", quantity: 120 },
    ];
    const agg = aggregateAw1Allocations(raw);
    expect(agg.get("Akidah Akhlak 1")).toBe(200);
    expect(agg.get("Prime Math 1A")).toBe(120);
  });
});
