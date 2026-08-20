import * as XLSX from "xlsx";

export const academicOfferSheetNames = [
  "OFERTAS",
  "RA_ASIGNATURA",
  "RA_PERFIL",
  "COMPETENCIAS",
  "UNIDADES",
  "DOCENTES",
  "ASIGNACIONES",
] as const;

type RawRow = Record<string, unknown>;

const utplGenericCompetencies = new Set([
  "Desarrollo personal integral",
  "Trabajo colaborativo",
  "Innovación y emprendimiento con visión de propósito",
  "Mentalidad sostenible",
  "Ciudadanía global",
]);

export type AcademicOfferImport = {
  offerings: Array<{
    code: string;
    periodCode: string;
    periodName: string;
    startsAt: string | null;
    endsAt: string | null;
    courseCode: string;
    courseName: string;
    sisCode: string | null;
    metacourseUrl: string | null;
    subjectTypeCode: string;
    totalWeeks: number;
    credits: number | null;
    acdHours: number;
    apeHours: number;
    aaHours: number;
    levelCode: string;
    levelName: string;
    modalityCode: string;
    modalityName: string;
    unitCode: string;
    unitName: string;
    programCode: string;
    programName: string;
    semester: string | null;
    description: string | null;
    prerequisites: string[];
    learningOutcomes: string[];
    graduateProfileResults: string[];
    professionalProfileCompetencies: string[];
    utplGenericCompetencies: string[];
    unitContents: string[];
  }>;
  teachers: Array<{
    nationalId: string;
    firstName: string;
    lastName: string;
    email: string;
  }>;
  assignments: Array<{ offeringCode: string; teacherNationalId: string }>;
  warnings: string[];
};

function normalizeHeader(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
}

function normalizedRow(row: RawRow) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
}

function text(row: RawRow, key: string, sheet: string, rowNumber: number, required = true) {
  const value = String(row[key] ?? "").trim().replace(/\s+/g, " ");
  if (required && !value) throw new Error(`${sheet}, fila ${rowNumber}: falta «${key}».`);
  return value;
}

function numberValue(row: RawRow, key: string, sheet: string, rowNumber: number, options: {
  integer?: boolean;
  min?: number;
  required?: boolean;
} = {}) {
  const raw = String(row[key] ?? "").trim();
  if (!raw && options.required === false) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || (options.integer && !Number.isInteger(value)) ||
      (options.min !== undefined && value < options.min)) {
    throw new Error(`${sheet}, fila ${rowNumber}: «${key}» no contiene un número válido.`);
  }
  return value;
}

function dateValue(row: RawRow, key: string, sheet: string, rowNumber: number) {
  const raw = row[key];
  if (raw === undefined || raw === null || raw === "") return null;
  const parsed = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(parsed.getTime())) throw new Error(`${sheet}, fila ${rowNumber}: «${key}» no contiene una fecha válida.`);
  return parsed.toISOString().slice(0, 10);
}

function list(value: string) {
  return value.split(/[;\n]+/).map((item) => item.trim()).filter(Boolean);
}

function sheetRows(workbook: XLSX.WorkBook, name: typeof academicOfferSheetNames[number]) {
  const sheet = workbook.Sheets[name];
  if (!sheet) throw new Error(`El libro no contiene la hoja obligatoria «${name}».`);
  return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "", raw: false })
    .map(normalizedRow);
}

function groupedTexts(
  rows: RawRow[],
  sheet: string,
  valueKey: string,
) {
  const groups = new Map<string, Array<{ order: number; value: string }>>();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const offeringCode = text(row, "id_oferta", sheet, rowNumber);
    const order = numberValue(row, "orden", sheet, rowNumber, { integer: true, min: 1 }) as number;
    const value = text(row, valueKey, sheet, rowNumber);
    const items = groups.get(offeringCode) ?? [];
    items.push({ order, value });
    groups.set(offeringCode, items);
  });
  return new Map([...groups].map(([code, items]) => [
    code,
    [...items].sort((a, b) => a.order - b.order).map((item) => item.value),
  ]));
}

export function parseAcademicOfferWorkbook(fileName: string, contentBase64: string): AcademicOfferImport {
  if (!/\.xlsx$/i.test(fileName)) throw new Error("La oferta académica debe cargarse en un archivo .xlsx.");
  const workbook = XLSX.read(Buffer.from(contentBase64, "base64"), { type: "buffer", cellDates: true });
  const rawOfferings = sheetRows(workbook, "OFERTAS");
  const learningOutcomes = groupedTexts(sheetRows(workbook, "RA_ASIGNATURA"), "RA_ASIGNATURA", "resultado_aprendizaje");
  const graduateResults = groupedTexts(sheetRows(workbook, "RA_PERFIL"), "RA_PERFIL", "resultado_perfil_egreso");
  const units = groupedTexts(sheetRows(workbook, "UNIDADES"), "UNIDADES", "unidad_contenido");
  const competenceRows = sheetRows(workbook, "COMPETENCIAS");
  const competenceGroups = new Map<string, { professional: Array<{ order: number; value: string }>; generic: Array<{ order: number; value: string }> }>();
  competenceRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const code = text(row, "id_oferta", "COMPETENCIAS", rowNumber);
    const type = text(row, "tipo", "COMPETENCIAS", rowNumber).toUpperCase();
    if (!['PROFESIONAL', 'GENERICA_UTPL'].includes(type)) {
      throw new Error(`COMPETENCIAS, fila ${rowNumber}: «tipo» debe ser PROFESIONAL o GENERICA_UTPL.`);
    }
    const order = numberValue(row, "orden", "COMPETENCIAS", rowNumber, { integer: true, min: 1 }) as number;
    const value = text(row, "descripcion", "COMPETENCIAS", rowNumber);
    const group = competenceGroups.get(code) ?? { professional: [], generic: [] };
    (type === "PROFESIONAL" ? group.professional : group.generic).push({ order, value });
    competenceGroups.set(code, group);
  });

  const codes = new Set<string>();
  const warnings: string[] = [];
  const offerings = rawOfferings.map((row, index) => {
    const rowNumber = index + 2;
    const code = text(row, "id_oferta", "OFERTAS", rowNumber).toUpperCase();
    if (codes.has(code)) throw new Error(`OFERTAS, fila ${rowNumber}: el id_oferta «${code}» está repetido.`);
    codes.add(code);
    const profileCompetencies = competenceGroups.get(code);
    const offering = {
      code,
      periodCode: text(row, "periodo_codigo", "OFERTAS", rowNumber).toUpperCase(),
      periodName: text(row, "periodo_nombre", "OFERTAS", rowNumber),
      startsAt: dateValue(row, "fecha_inicio", "OFERTAS", rowNumber),
      endsAt: dateValue(row, "fecha_fin", "OFERTAS", rowNumber),
      courseCode: text(row, "asignatura_codigo", "OFERTAS", rowNumber).toUpperCase(),
      courseName: text(row, "asignatura_nombre", "OFERTAS", rowNumber),
      sisCode: text(row, "codigo_sis", "OFERTAS", rowNumber, false) || null,
      metacourseUrl: text(row, "url_metacurso", "OFERTAS", rowNumber, false) || null,
      subjectTypeCode: text(row, "tipo_asignatura_codigo", "OFERTAS", rowNumber).toUpperCase(),
      totalWeeks: numberValue(row, "numero_semanas", "OFERTAS", rowNumber, { integer: true, min: 1 }) as number,
      credits: numberValue(row, "creditos", "OFERTAS", rowNumber, { min: 0, required: false }),
      acdHours: numberValue(row, "horas_acd", "OFERTAS", rowNumber, { integer: true, min: 0 }) as number,
      apeHours: numberValue(row, "horas_ape", "OFERTAS", rowNumber, { integer: true, min: 0 }) as number,
      aaHours: numberValue(row, "horas_aa", "OFERTAS", rowNumber, { integer: true, min: 0 }) as number,
      levelCode: text(row, "nivel_codigo", "OFERTAS", rowNumber).toUpperCase(),
      levelName: text(row, "nivel_nombre", "OFERTAS", rowNumber),
      modalityCode: text(row, "modalidad_codigo", "OFERTAS", rowNumber).toUpperCase(),
      modalityName: text(row, "modalidad_nombre", "OFERTAS", rowNumber),
      unitCode: text(row, "facultad_codigo", "OFERTAS", rowNumber).toUpperCase(),
      unitName: text(row, "facultad_nombre", "OFERTAS", rowNumber),
      programCode: text(row, "carrera_codigo", "OFERTAS", rowNumber).toUpperCase(),
      programName: text(row, "carrera_nombre", "OFERTAS", rowNumber),
      semester: text(row, "semestre", "OFERTAS", rowNumber, false) || null,
      description: text(row, "descripcion", "OFERTAS", rowNumber, false) || null,
      prerequisites: list(text(row, "prerrequisitos", "OFERTAS", rowNumber, false)),
      learningOutcomes: learningOutcomes.get(code) ?? [],
      graduateProfileResults: graduateResults.get(code) ?? [],
      professionalProfileCompetencies: (profileCompetencies?.professional ?? [])
        .sort((a, b) => a.order - b.order).map((item) => item.value),
      utplGenericCompetencies: (profileCompetencies?.generic ?? [])
        .sort((a, b) => a.order - b.order).map((item) => item.value),
      unitContents: units.get(code) ?? [],
    };
    for (const [label, values] of [
      ["resultados de aprendizaje", offering.learningOutcomes],
      ["resultados del perfil de egreso", offering.graduateProfileResults],
      ["competencias profesionales", offering.professionalProfileCompetencies],
      ["unidades o contenidos", offering.unitContents],
    ] as const) {
      if (!values.length) throw new Error(`La oferta «${code}» no contiene ${label}.`);
    }
    if (!offering.utplGenericCompetencies.length) {
      warnings.push(`La oferta «${code}» no contiene competencias genéricas UTPL; el profesor no podrá seleccionarlas.`);
    }
    const invalidGeneric = offering.utplGenericCompetencies.filter((item) => !utplGenericCompetencies.has(item));
    if (invalidGeneric.length) {
      throw new Error(`La oferta «${code}» contiene competencias genéricas UTPL no reconocidas: ${invalidGeneric.join(", ")}.`);
    }
    return offering;
  });

  const courseMetadata = new Map<string, { sisCode: string | null; metacourseUrl: string | null }>();
  const sisCodes = new Map<string, string>();
  const metacourseUrls = new Map<string, string>();
  for (const offering of offerings) {
    if (offering.metacourseUrl) {
      try {
        const parsedUrl = new URL(offering.metacourseUrl);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("protocol");
      } catch {
        throw new Error(`La asignatura «${offering.courseCode}» contiene una URL de metacurso no válida; utilice http:// o https://.`);
      }
    }
    if (offering.sisCode) {
      const owner = sisCodes.get(offering.sisCode);
      if (owner && owner !== offering.courseCode) throw new Error(`El Código SIS «${offering.sisCode}» está asignado a más de una asignatura (${owner} y ${offering.courseCode}).`);
      sisCodes.set(offering.sisCode, offering.courseCode);
    }
    if (offering.metacourseUrl) {
      const owner = metacourseUrls.get(offering.metacourseUrl);
      if (owner && owner !== offering.courseCode) throw new Error(`La URL metacurso «${offering.metacourseUrl}» está asignada a más de una asignatura (${owner} y ${offering.courseCode}).`);
      metacourseUrls.set(offering.metacourseUrl, offering.courseCode);
    }
    const previous = courseMetadata.get(offering.courseCode);
    if (previous && (previous.sisCode !== offering.sisCode || previous.metacourseUrl !== offering.metacourseUrl)) {
      throw new Error(`La asignatura «${offering.courseCode}» aparece con Código SIS o URL metacurso diferentes entre ofertas.`);
    }
    courseMetadata.set(offering.courseCode, { sisCode: offering.sisCode, metacourseUrl: offering.metacourseUrl });
  }

  const teachers = sheetRows(workbook, "DOCENTES").map((row, index) => {
    const rowNumber = index + 2;
    const email = text(row, "correo", "DOCENTES", rowNumber).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`DOCENTES, fila ${rowNumber}: el correo no es válido.`);
    return {
      nationalId: text(row, "cedula", "DOCENTES", rowNumber),
      firstName: text(row, "nombres", "DOCENTES", rowNumber),
      lastName: text(row, "apellidos", "DOCENTES", rowNumber),
      email,
    };
  });
  const teacherIds = new Set(teachers.map((teacher) => teacher.nationalId));
  if (teacherIds.size !== teachers.length) throw new Error("La hoja DOCENTES contiene cédulas duplicadas.");

  const assignments = sheetRows(workbook, "ASIGNACIONES").map((row, index) => {
    const rowNumber = index + 2;
    const offeringCode = text(row, "id_oferta", "ASIGNACIONES", rowNumber).toUpperCase();
    const teacherNationalId = text(row, "cedula", "ASIGNACIONES", rowNumber);
    if (!codes.has(offeringCode)) throw new Error(`ASIGNACIONES, fila ${rowNumber}: la oferta «${offeringCode}» no existe.`);
    if (!teacherIds.has(teacherNationalId)) throw new Error(`ASIGNACIONES, fila ${rowNumber}: la cédula «${teacherNationalId}» no existe en DOCENTES.`);
    return { offeringCode, teacherNationalId };
  });
  if (new Set(assignments.map((item) => item.offeringCode)).size !== assignments.length) {
    throw new Error("ASIGNACIONES contiene más de un profesor vigente para la misma oferta.");
  }
  return { offerings, teachers, assignments, warnings };
}
