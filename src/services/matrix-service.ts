import * as XLSX from "xlsx";

export const requiredColumns = [
  "Semana",
  "Resultado de aprendizaje",
  "Unidad/Contenido",
  "Metodología",
] as const;

export type MatrixRow = Record<(typeof requiredColumns)[number], string>;

const normalize = (value: unknown) =>
  String(value ?? "").trim().toLocaleLowerCase("es");

export function parseMatrix(fileName: string, base64Content: string): MatrixRow[] {
  const fileBuffer = Buffer.from(base64Content, "base64");
  const workbook = /\.csv$/i.test(fileName)
    ? XLSX.read(fileBuffer.toString("utf8"), { type: "string" })
    : XLSX.read(fileBuffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no contiene hojas de cálculo.");
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("No fue posible leer la primera hoja.");
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    sheet,
    { defval: "" },
  );
  if (!rawRows.length) throw new Error("La matriz no contiene registros.");
  const firstRow = rawRows[0];
  if (!firstRow) throw new Error("La matriz no contiene registros.");
  const headers = Object.keys(firstRow);
  const mapped = new Map(headers.map((header) => [normalize(header), header]));
  const missing = requiredColumns.filter((column) => !mapped.has(normalize(column)));
  if (missing.length) {
    throw new Error(`Faltan las columnas obligatorias: ${missing.join(", ")}.`);
  }
  return rawRows.map((row) =>
    Object.fromEntries(
      requiredColumns.map((column) => [
        column,
        String(row[mapped.get(normalize(column))!] ?? "").trim(),
      ]),
    ) as MatrixRow,
  ).filter((row) => Object.values(row).some(Boolean));
}
