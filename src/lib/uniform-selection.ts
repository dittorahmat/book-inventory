import type { UniformCatalog, UniformPackageOption, UniformVariantOption, UniformStudent } from "./uniform-types";
import { gradeToJenjang } from "./uniform-types";

export interface MatchedUniformSelection {
  package: UniformPackageOption | null;
  olahraga: UniformVariantOption | null;
}

export function findMatchingUniformSelection(
  student: UniformStudent | null,
  catalog: UniformCatalog | null
): MatchedUniformSelection {
  if (!student || !catalog) return { package: null, olahraga: null };

  const jenjang = gradeToJenjang(student.gradeLevel);
  const gender = student.gender;
  const variantById = new Map(catalog.variants.map((v) => [v.id, v]));

  const matchedPkg = catalog.packages.find((p) =>
    p.bom.every((b) => {
      const v = variantById.get(b.variantId);
      return v && v.jenjang === jenjang && (!gender || v.gender === gender);
    })
  ) ?? null;

  const matchedOlahraga = catalog.variants.find(
    (v) => v.kind === "olahraga" && v.jenjang === jenjang && (!gender || v.gender === gender)
  ) ?? null;

  return { package: matchedPkg, olahraga: matchedOlahraga };
}
