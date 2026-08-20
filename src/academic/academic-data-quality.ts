export type BibliographyType = "BASIC" | "COMPLEMENTARY" | "REA";

export function normalizeAcademicText(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("es");
}

export function assertUniqueOfferingUnitsAndContents(values: string[]) {
  const unitTitles = new Map<string, string>();
  const contentTitles = new Map<string, string>();

  for (const rawValue of values) {
    const value = rawValue.trim();
    if (!value) continue;
    const unitMatch = /^UNIDAD\s*:\s*(.+)$/iu.exec(value);
    const contentMatch = /^CONTENIDO\s*:\s*(.+)$/iu.exec(value);
    if (/^SUBCONTENIDO\s*:/iu.test(value)) continue;

    const category = contentMatch ? "content" : "unit";
    const display = (contentMatch?.[1] ?? unitMatch?.[1] ?? value).trim();
    if (!display) continue;
    const normalized = normalizeAcademicText(display);
    const target = category === "content" ? contentTitles : unitTitles;
    const previous = target.get(normalized);
    if (previous) {
      const label = category === "content" ? "tema o contenido" : "unidad";
      throw new Error(`No se puede repetir ${label} «${display}» en la misma asignatura.`);
    }
    target.set(normalized, display);
  }
}

export function missingRequiredBibliographyTypes(entries: Array<{ type: BibliographyType }>) {
  const types = new Set(entries.map((entry) => entry.type));
  const missing: BibliographyType[] = [];
  if (!types.has("COMPLEMENTARY")) missing.push("COMPLEMENTARY");
  if (!types.has("REA")) missing.push("REA");
  return missing;
}
