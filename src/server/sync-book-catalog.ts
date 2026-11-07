import { eq } from "drizzle-orm";
import type { AppDatabase } from "../db";
import { books } from "../db/schema";

export interface BookCatalogSyncRule {
  pattern: RegExp;
  standardIsbn?: string;
  discountRate: number; // e.g. 0.40 for 40%
  fixedNetPrice?: number;
}

export const CATALOG_SYNC_RULES: BookCatalogSyncRule[] = [
  // CNL / Scholastic (40% discount)
  { pattern: /PR[1I]ME MATH.*1A.*(COURSE|STUDENT)/i, standardIsbn: "9789814969529", discountRate: 0.4 },
  { pattern: /PR[1I]ME MATH.*1B.*(COURSE|STUDENT)/i, standardIsbn: "9789814969536", discountRate: 0.4 },
  { pattern: /PR[1I]ME MATH.*1A.*WORKBOOK/i, standardIsbn: "9789814969642", discountRate: 0.4 },
  { pattern: /PR[1I]ME MATH.*1B.*WORKBOOK/i, standardIsbn: "9789814969659", discountRate: 0.4 },
  { pattern: /PR[1I]ME MATH.*2A.*(COURSE|STUDENT)/i, standardIsbn: "9789814969543", discountRate: 0.4 },
  { pattern: /PR[1I]ME MATH.*2B.*(COURSE|STUDENT)/i, standardIsbn: "9789814969550", discountRate: 0.4 },
  { pattern: /PR[1I]ME MATH.*2A.*WORKBOOK/i, standardIsbn: "9789814969666", discountRate: 0.4 },
  { pattern: /PR[1I]ME MATH.*2B.*WORKBOOK/i, standardIsbn: "9789814969673", discountRate: 0.4 },
  { pattern: /PR[1I]ME MATH.*3A.*(COURSE|STUDENT)/i, standardIsbn: "9789814969567", discountRate: 0.4 },
  { pattern: /PR[1I]ME MATH.*3B.*(COURSE|STUDENT)/i, standardIsbn: "9789814969574", discountRate: 0.4 },
  { pattern: /PR[1I]ME MATH.*4A.*(COURSE|STUDENT)/i, standardIsbn: "9789814969581", discountRate: 0.4 },
  { pattern: /PR[1I]ME MATH.*4B.*(COURSE|STUDENT)/i, standardIsbn: "9789814969598", discountRate: 0.4 },
  { pattern: /PR[1I]ME MATH.*5A.*(COURSE|STUDENT)/i, standardIsbn: "9789814969604", discountRate: 0.4 },
  { pattern: /PR[1I]ME MATH.*5B.*(COURSE|STUDENT)/i, standardIsbn: "9789814969611", discountRate: 0.4 },
  { pattern: /PR[1I]ME MATH.*6A.*(COURSE|STUDENT)/i, standardIsbn: "9789814969628", discountRate: 0.4 },
  { pattern: /PR[1I]ME MATH.*6B.*(COURSE|STUDENT)/i, standardIsbn: "9789814969635", discountRate: 0.4 },

  // Cambridge English (40% discount)
  { pattern: /ENGLISH STUDENT BOOK\+WORKBOOK 1/i, standardIsbn: "9781108789981", discountRate: 0.4 },
  { pattern: /ENGLISH STUDENT BOOK\+WORKBOOK 2/i, standardIsbn: "9781108789998", discountRate: 0.4 },
  { pattern: /ENGLISH STUDENT BOOK\+WORKBOOK 3/i, standardIsbn: "9781108790000", discountRate: 0.4 },

  // Cambridge Secondary (Mentari - 25% discount)
  { pattern: /IGCSE.*MATH.*STUDENT/i, standardIsbn: "9789814913065", discountRate: 0.25 },
  { pattern: /IGCSE.*MATH.*WORKBOOK/i, standardIsbn: "9789814913072", discountRate: 0.25 },
  { pattern: /IGCSE.*BIOLOGY/i, standardIsbn: "9789815027358", discountRate: 0.25 },
  { pattern: /IGCSE.*CHEMISTRY/i, standardIsbn: "9789815027365", discountRate: 0.25 },
  { pattern: /IGCSE.*PHYSICS/i, standardIsbn: "9789815027372", discountRate: 0.25 },

  // Pelangi Books (20% discount)
  { pattern: /I LEAP NURSERY/i, discountRate: 0.2 },
  { pattern: /I LEAP K1/i, discountRate: 0.2 },
  { pattern: /I LEAP K2/i, discountRate: 0.2 },
  { pattern: /YOK!HOP/i, discountRate: 0.2 },
  { pattern: /MY PRESCHOOL WORLD/i, discountRate: 0.2 },

  // Erlangga Diknas (40% discount)
  { pattern: /MATEMATIKA [1-6]/i, discountRate: 0.4 },
  { pattern: /PENDIDIKAN PANCASILA/i, discountRate: 0.4 },
  { pattern: /BAHASA INDONESIA [1-6]/i, discountRate: 0.4 },
  { pattern: /IPA [1-6]/i, discountRate: 0.4 },
  { pattern: /IPS [1-6]/i, discountRate: 0.4 },

  // Darsyafii / Pustaka Imam Syafii (35% discount)
  { pattern: /AKIDAH AKHLAK/i, discountRate: 0.35 },
  { pattern: /FIKIH/i, discountRate: 0.35 },
  { pattern: /SKI/i, discountRate: 0.35 },
  { pattern: /HADIST/i, discountRate: 0.35 },

  // Percetakan Bahasa Arab Segara (28% discount)
  { pattern: /BAHASA ARAB/i, discountRate: 0.28 },
];

export async function syncBookCatalogPricingAndIsbn(targetDb: AppDatabase) {
  const allBooks = await targetDb.select().from(books);
  let updatedCount = 0;
  const now = new Date().toISOString();

  for (const b of allBooks) {
    const title = b.title || "";
    let matchedRule: BookCatalogSyncRule | undefined;

    for (const rule of CATALOG_SYNC_RULES) {
      if (rule.pattern.test(title)) {
        matchedRule = rule;
        break;
      }
    }

    if (!matchedRule) continue;

    const basePrice = b.sellPrice > 0 ? b.sellPrice : b.price;
    const computedBuyPrice = matchedRule.fixedNetPrice ?? Math.round(basePrice * (1 - matchedRule.discountRate));
    const targetIsbn = matchedRule.standardIsbn || b.isbn;

    const shouldUpdatePrice = b.buyPrice === 0 || b.buyPrice === b.sellPrice || b.buyPrice !== computedBuyPrice;
    const shouldUpdateIsbn = matchedRule.standardIsbn && b.isbn !== matchedRule.standardIsbn;

    if (shouldUpdatePrice || shouldUpdateIsbn) {
      await targetDb
        .update(books)
        .set({
          isbn: targetIsbn,
          buyPrice: computedBuyPrice,
          updatedAt: now,
        })
        .where(eq(books.id, b.id));
      updatedCount++;
    }
  }

  return { updatedCount };
}
