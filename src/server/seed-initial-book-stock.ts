export interface ParsedStockItem {
  section: string;
  sheetTitle: string;
  stockQuantity: number;
}

export function parseRekapAw1Stock(csvContent: string): ParsedStockItem[] {
  const lines = csvContent.split("\n");
  let currentSection = "";
  const items: ParsedStockItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(",");
    if (parts[0].match(/^[I|V|X]+/)) {
      currentSection = parts[2] || parts[0];
      continue;
    }
    if (
      line.includes("GRAND TOTAL") ||
      line.includes("KEBUTUHAN BUKU") ||
      line.includes("BUKU TERBAGI")
    ) {
      continue;
    }

    const rawTitle = parts[2]?.trim();
    if (!rawTitle || rawTitle === "-" || rawTitle === "List Buku Umum") continue;
    const title = rawTitle.replace(/^"+|"+$/g, "");

    let stokVal = 0;
    if (currentSection.includes("List Buku Umum")) {
      // Di bagian Umum: parts[23] adalah kolom STOK
      const rawStok = parts[23]?.trim().replace(/\./g, "").replace(/,/g, "");
      if (rawStok && rawStok !== "-" && !isNaN(Number(rawStok))) {
        stokVal = Number(rawStok);
      }
    } else {
      // Di bagian kelas jenjang: parts[10] adalah kolom STOK
      const rawStok = parts[10]?.trim().replace(/\./g, "").replace(/,/g, "");
      if (rawStok && rawStok !== "-" && !isNaN(Number(rawStok))) {
        stokVal = Number(rawStok);
      }
    }

    if (stokVal > 0) {
      items.push({
        section: currentSection,
        sheetTitle: title,
        stockQuantity: stokVal,
      });
    }
  }

  return items;
}

export function matchBookToStock(
  sheetTitle: string,
  section: string,
  books: Array<{ id: string; title: string }>
): { id: string; title: string } | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const targetNorm = norm(sheetTitle);

  // Exact norm match
  for (const b of books) {
    if (norm(b.title) === targetNorm) return b;
  }

  const gradeMatch = section.match(/(?:KLS|Kelas)\s*([0-9]+)/i);
  const grade = gradeMatch ? gradeMatch[1] : "";

  // Prime Math Student Book -> COURSEBOOK, Workbook -> PRACTICE BOOK
  if (targetNorm.includes("primemath")) {
    const semMatch = targetNorm.match(/([1-6][ab])/);
    if (semMatch) {
      if (targetNorm.includes("workbook") || targetNorm.includes("practice")) {
        const expected = norm(`PRIME MATH ${semMatch[1]} PRACTICE BOOK`);
        for (const b of books) {
          if (norm(b.title) === expected) return b;
        }
      } else if (targetNorm.includes("studentbook") || targetNorm.includes("coursebook")) {
        const expected = norm(`PRIME MATH ${semMatch[1]} COURSEBOOK`);
        for (const b of books) {
          if (norm(b.title) === expected) return b;
        }
      }
    }
  }

  // Science Workbook -> ACTIVITY BOOK
  if (targetNorm.includes("science") && targetNorm.includes("workbook")) {
    const semMatch = targetNorm.match(/([1-6][ab])/);
    if (semMatch) {
      const expected = norm(`SCIENCE ${semMatch[1]} ACTIVITY BOOK`);
      for (const b of books) {
        if (norm(b.title) === expected) return b;
      }
    }
  }

  // Akidah / Fikih / SKI with grade
  if (grade) {
    if (targetNorm === "akidahakhlak" || targetNorm === "akidah") {
      const expected = norm(`AKIDAH AKHLAK ${grade}`);
      for (const b of books) {
        if (norm(b.title) === expected) return b;
      }
    }
    if (targetNorm === "fikih") {
      const expected = norm(`FIKIH ${grade}`);
      for (const b of books) {
        if (norm(b.title) === expected) return b;
      }
    }
    if (targetNorm.includes("sejarahkebudayaanislam") || targetNorm === "ski") {
      const expected = norm(`SKI ${grade}`);
      for (const b of books) {
        if (norm(b.title) === expected) return b;
      }
    }
  }

  // ABY
  if (targetNorm === "aby1a") {
    for (const b of books) {
      if (norm(b.title) === norm("BAHASA ARAB ABY JILID 1A")) return b;
    }
  }
  if (targetNorm === "aby1b") {
    for (const b of books) {
      if (norm(b.title) === norm("BAHASA ARAB ABY JILID 1B")) return b;
    }
  }
  if (targetNorm === "aby2a") {
    for (const b of books) {
      if (norm(b.title) === norm("BAHASA ARAB ABY JILID 2A")) return b;
    }
  }

  // Substring fuzzy with grade awareness
  for (const b of books) {
    const bn = norm(b.title);
    if (grade && bn.includes(grade) && (bn.includes(targetNorm) || targetNorm.includes(bn))) {
      return b;
    }
  }

  return null;
}
